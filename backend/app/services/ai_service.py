from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.ai.prompts import build_prompt_set
from app.ai.provider import AIProvider
from app.ai.schemas import (
    AIHistoryItem,
    AISuggestionDecisionResponse,
    AIStreamDonePayload,
    AIStreamRequest,
)
from app.models.ai_interaction import AIInteraction, AIInteractionStatus
from app.models.ai_suggestion import AISuggestion, AISuggestionDecisionStatus
from app.models.document import Document
from app.models.user import User


class AIService:
    """Prompt construction, streaming, and history persistence for AI interactions."""

    def __init__(self, db: Session, provider: AIProvider) -> None:
        self.db = db
        self.provider = provider

    async def stream_response(
        self,
        *,
        document: Document,
        user: User,
        payload: AIStreamRequest,
    ) -> AsyncIterator[str]:
        prompt_set = build_prompt_set(payload.action, payload.selected_text, payload.options)
        interaction = AIInteraction(
            document_id=document.id,
            user_id=user.id,
            action=payload.action,
            selected_text=payload.selected_text,
            prompt_text=prompt_set.prompt_text,
            model_name=self.provider.model_name,
            status=AIInteractionStatus.in_progress,
        )
        self.db.add(interaction)
        self.db.commit()
        self.db.refresh(interaction)

        accumulated_chunks: list[str] = []
        try:
            async for chunk in self.provider.stream_completion(
                action=payload.action,
                system_prompt=prompt_set.system_prompt,
                user_prompt=prompt_set.user_prompt,
            ):
                accumulated_chunks.append(chunk)
                yield self._format_data_event(chunk)

            suggestion = AISuggestion(
                ai_interaction_id=interaction.id,
                suggested_text="".join(accumulated_chunks),
            )
            interaction.status = AIInteractionStatus.completed
            self.db.add(suggestion)
            self.db.add(interaction)
            self.db.commit()
            self.db.refresh(suggestion)

            done_payload = AIStreamDonePayload(
                interaction_id=interaction.id,
                suggestion_id=suggestion.id,
            )
            yield self._format_done_event(done_payload.model_dump_json())
        except Exception:
            interaction.status = AIInteractionStatus.failed
            self.db.add(interaction)
            self.db.commit()
            yield self._format_error_event("AI generation failed.")

    def get_history(self, document: Document) -> list[AIHistoryItem]:
        statement: Select[tuple[AIInteraction, User, AISuggestion | None]] = (
            select(AIInteraction, User, AISuggestion)
            .join(User, User.id == AIInteraction.user_id)
            .outerjoin(AISuggestion, AISuggestion.ai_interaction_id == AIInteraction.id)
            .where(AIInteraction.document_id == document.id)
            .order_by(AIInteraction.created_at.desc(), AIInteraction.id.desc())
        )

        return [
            AIHistoryItem(
                interaction_id=interaction.id,
                document_id=interaction.document_id,
                user_id=user.id,
                username=user.username,
                action=interaction.action,
                selected_text=interaction.selected_text,
                prompt_text=interaction.prompt_text,
                model_name=interaction.model_name,
                status=interaction.status,
                created_at=interaction.created_at,
                suggestion_id=suggestion.id if suggestion is not None else None,
                suggested_text=suggestion.suggested_text if suggestion is not None else None,
                decision_status=suggestion.decision_status if suggestion is not None else None,
            )
            for interaction, user, suggestion in self.db.execute(statement).all()
        ]

    def get_interaction(self, interaction_id: int) -> AIInteraction | None:
        return self.db.get(AIInteraction, interaction_id)

    def get_suggestion_for_interaction(self, interaction_id: int) -> AISuggestion | None:
        return self.db.scalar(
            select(AISuggestion).where(AISuggestion.ai_interaction_id == interaction_id)
        )

    def get_suggestion_or_404(self, suggestion_id: int) -> AISuggestion:
        suggestion = self.db.get(AISuggestion, suggestion_id)
        if suggestion is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI suggestion not found.",
            )
        return suggestion

    def update_suggestion_decision(
        self,
        *,
        suggestion: AISuggestion,
        decision: AISuggestionDecisionStatus,
    ) -> AISuggestionDecisionResponse:
        suggestion.decision_status = decision
        self.db.add(suggestion)
        self.db.commit()
        self.db.refresh(suggestion)
        return AISuggestionDecisionResponse(
            suggestion_id=suggestion.id,
            interaction_id=suggestion.ai_interaction_id,
            decision_status=suggestion.decision_status,
        )

    @staticmethod
    def _format_data_event(content: str) -> str:
        return f"data: {content}\n\n"

    @staticmethod
    def _format_done_event(payload: str) -> str:
        data = json.loads(payload)
        return f"event: done\ndata: {json.dumps(data)}\n\n"

    @staticmethod
    def _format_error_event(detail: str) -> str:
        return f"event: error\ndata: {detail}\n\n"
