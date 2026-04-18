from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.ai_interaction import AIAction, AIInteractionStatus
from app.models.ai_suggestion import AISuggestionDecisionStatus


class AIStreamRequest(BaseModel):
    document_id: int
    action: AIAction
    selected_text: str = Field(min_length=1, max_length=8000)
    options: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def support_feature_alias(cls, data: object) -> object:
        if isinstance(data, dict) and "action" not in data and "feature" in data:
            normalized = dict(data)
            normalized["action"] = normalized["feature"]
            return normalized
        return data

    @field_validator("selected_text")
    @classmethod
    def validate_selected_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("selected_text must not be blank.")
        return normalized


class AIStreamDonePayload(BaseModel):
    interaction_id: int
    suggestion_id: int


class AICanceledPayload(BaseModel):
    interaction_id: int


class AIHistoryItem(BaseModel):
    interaction_id: int
    document_id: int
    user_id: int
    username: str
    action: AIAction
    selected_text: str
    prompt_text: str
    model_name: str
    status: AIInteractionStatus
    created_at: datetime
    suggestion_id: int | None
    suggested_text: str | None
    decision_status: AISuggestionDecisionStatus | None


class AISuggestionDecisionRequest(BaseModel):
    decision: AISuggestionDecisionStatus

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, value: AISuggestionDecisionStatus) -> AISuggestionDecisionStatus:
        if value == AISuggestionDecisionStatus.pending:
            raise ValueError("decision must be accepted or rejected.")
        return value


class AISuggestionDecisionResponse(BaseModel):
    suggestion_id: int
    interaction_id: int
    decision_status: AISuggestionDecisionStatus


class AIInteractionCancelResponse(BaseModel):
    interaction_id: int
    status: AIInteractionStatus
