from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.document_permission import DocumentRole

DocumentSaveMode = Literal["autosave", "manual", "ai_apply"]


class DocumentCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = ""


class DocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    save_mode: DocumentSaveMode = "manual"

    @model_validator(mode="after")
    def validate_update_fields(self) -> "DocumentUpdateRequest":
        if self.title is None and self.content is None:
            raise ValueError("At least one of title or content must be provided.")
        return self


class DocumentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    owner_user_id: int
    created_at: datetime
    updated_at: datetime
    role: DocumentRole


class DocumentRead(DocumentListItem):
    current_content: str
