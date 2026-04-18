from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.ai.schemas import (
    AIHistoryItem,
    AIInteractionCancelResponse,
    AISuggestionDecisionRequest,
    AISuggestionDecisionResponse,
    AIStreamRequest,
)
from app.api.deps import (
    get_ai_service,
    get_current_active_user,
    get_document_service,
    get_permission_service,
)
from app.models.document_permission import DocumentRole
from app.models.user import User
from app.services.ai_service import AIService
from app.services.document_service import DocumentService
from app.services.permission_service import PermissionService

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/stream")
async def stream_ai(
    payload: AIStreamRequest,
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
    permission_service: PermissionService = Depends(get_permission_service),
    ai_service: AIService = Depends(get_ai_service),
) -> StreamingResponse:
    """Stream AI suggestion chunks as text/event-stream."""

    document = document_service.get_document_or_404(payload.document_id)
    role = permission_service.get_user_document_role(document, current_user)
    if role not in (DocumentRole.owner, DocumentRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and editors can use AI features for this document.",
        )

    return StreamingResponse(
        ai_service.stream_response(
            document=document,
            user=current_user,
            payload=payload,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history/{document_id}", response_model=list[AIHistoryItem])
def get_ai_history(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
    permission_service: PermissionService = Depends(get_permission_service),
    ai_service: AIService = Depends(get_ai_service),
) -> list[AIHistoryItem]:
    """Return persisted AI history for a document. Owner/editor only."""

    document = document_service.get_document_or_404(document_id)
    role = permission_service.get_user_document_role(document, current_user)
    if role not in (DocumentRole.owner, DocumentRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and editors can view AI history for this document.",
        )

    return ai_service.get_history(document)


@router.post("/suggestions/{suggestion_id}/decision", response_model=AISuggestionDecisionResponse)
def update_suggestion_decision(
    suggestion_id: int,
    payload: AISuggestionDecisionRequest,
    current_user: User = Depends(get_current_active_user),
    permission_service: PermissionService = Depends(get_permission_service),
    document_service: DocumentService = Depends(get_document_service),
    ai_service: AIService = Depends(get_ai_service),
) -> AISuggestionDecisionResponse:
    """Persist accept/reject state for a completed AI suggestion."""

    suggestion = ai_service.get_suggestion_or_404(suggestion_id)
    interaction = ai_service.get_interaction(suggestion.ai_interaction_id)
    if interaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI interaction not found.",
        )

    document = document_service.get_document_or_404(interaction.document_id)
    role = permission_service.get_user_document_role(document, current_user)
    if role not in (DocumentRole.owner, DocumentRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and editors can update AI suggestion decisions for this document.",
        )

    return ai_service.update_suggestion_decision(
        suggestion=suggestion,
        decision=payload.decision,
    )


@router.post("/interactions/{interaction_id}/cancel", response_model=AIInteractionCancelResponse)
def cancel_ai_interaction(
    interaction_id: int,
    current_user: User = Depends(get_current_active_user),
    permission_service: PermissionService = Depends(get_permission_service),
    document_service: DocumentService = Depends(get_document_service),
    ai_service: AIService = Depends(get_ai_service),
) -> AIInteractionCancelResponse:
    """Cancel an in-progress AI interaction."""

    interaction = ai_service.get_interaction_or_404(interaction_id)
    document = document_service.get_document_or_404(interaction.document_id)
    role = permission_service.get_user_document_role(document, current_user)
    if role not in (DocumentRole.owner, DocumentRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and editors can cancel AI interactions for this document.",
        )

    return ai_service.cancel_interaction(interaction)
