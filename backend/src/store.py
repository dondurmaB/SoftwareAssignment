from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from .models import CreateDocumentRequest, DocumentDto, UpdateDocumentRequest, to_iso_string


@dataclass
class DocumentRecord:
    id: str
    owner_user_id: str
    title: str
    current_content: str
    latest_version_id: str | None
    created_at: datetime
    updated_at: datetime

    def to_dto(self) -> DocumentDto:
        return DocumentDto(
            id=self.id,
            ownerUserId=self.owner_user_id,
            title=self.title,
            currentContent=self.current_content,
            latestVersionId=self.latest_version_id,
            createdAt=to_iso_string(self.created_at),
            updatedAt=to_iso_string(self.updated_at),
        )


class InMemoryDocumentStore:
    def __init__(self) -> None:
        self._documents: dict[str, DocumentRecord] = {}

    def create_document(self, request: CreateDocumentRequest) -> DocumentDto:
        now = datetime.now(UTC)
        record = DocumentRecord(
            id=str(uuid4()),
            owner_user_id="demo-user",
            title=request.title,
            current_content=request.content,
            latest_version_id=None,
            created_at=now,
            updated_at=now,
        )
        self._documents[record.id] = record
        return record.to_dto()

    def get_document(self, document_id: str) -> DocumentDto | None:
        record = self._documents.get(document_id)
        return record.to_dto() if record else None

    def update_document(self, document_id: str, request: UpdateDocumentRequest) -> DocumentDto | None:
        record = self._documents.get(document_id)
        if record is None:
            return None

        record.current_content = request.content
        record.updated_at = datetime.now(UTC)
        return record.to_dto()
