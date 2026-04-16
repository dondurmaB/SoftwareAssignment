from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, EmailStr, Field

from app.models.document_permission import DocumentRole


class AssignableDocumentRole(str, Enum):
    editor = "editor"
    viewer = "viewer"


class ShareDocumentRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    role: AssignableDocumentRole


class UpdateDocumentPermissionRequest(BaseModel):
    role: AssignableDocumentRole


class DocumentPermissionRead(BaseModel):
    user_id: int
    email: EmailStr
    username: str
    role: DocumentRole
