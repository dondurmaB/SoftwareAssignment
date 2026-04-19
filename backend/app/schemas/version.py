from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DocumentVersionRead(BaseModel):
    id: int
    version_number: int
    created_by_user_id: int
    created_at: datetime
    restored_from_version_number: int | None = None
    is_current: bool = False


class DocumentRestoreResponse(BaseModel):
    id: int
    title: str
    current_content: str
    updated_at: datetime
