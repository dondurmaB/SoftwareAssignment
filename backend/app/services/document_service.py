from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.security import utc_now
from app.models.document import Document
from app.models.document_permission import DocumentPermission, DocumentRole
from app.models.document_version import DocumentVersion
from app.models.user import User
from app.schemas.document import DocumentCreateRequest, DocumentUpdateRequest


@dataclass
class DocumentVisibility:
    document: Document
    role: DocumentRole


class DocumentService:
    """Business logic for document lifecycle and version history."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_document(self, owner: User, payload: DocumentCreateRequest) -> DocumentVisibility:
        document = Document(
            owner_user_id=owner.id,
            title=payload.title.strip(),
            current_content=payload.content,
        )
        self.db.add(document)
        self._commit_or_rollback()
        self.db.refresh(document)
        return DocumentVisibility(document=document, role=DocumentRole.owner)

    def list_documents_for_user(self, user: User) -> list[DocumentVisibility]:
        permission_alias = aliased(DocumentPermission)
        statement: Select[tuple[Document, DocumentRole | None]] = (
            select(Document, permission_alias.role)
            .outerjoin(
                permission_alias,
                and_(
                    permission_alias.document_id == Document.id,
                    permission_alias.user_id == user.id,
                ),
            )
            .where(
                or_(
                    Document.owner_user_id == user.id,
                    permission_alias.user_id == user.id,
                )
            )
            .order_by(Document.updated_at.desc(), Document.id.desc())
        )

        rows = self.db.execute(statement).all()
        return [
            DocumentVisibility(
                document=document,
                role=DocumentRole.owner if document.owner_user_id == user.id else role,
            )
            for document, role in rows
            if role is not None or document.owner_user_id == user.id
        ]

    def get_document_or_404(self, document_id: int) -> Document:
        document = self.db.get(Document, document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )
        return document

    def update_document(self, document: Document, actor: User, payload: DocumentUpdateRequest) -> Document:
        if payload.title is not None:
            document.title = payload.title.strip()
        if payload.content is not None:
            document.current_content = payload.content

        document.updated_at = utc_now()
        version_number = self._next_version_number(document.id)
        version = DocumentVersion(
            document_id=document.id,
            version_number=version_number,
            created_by_user_id=actor.id,
            content_snapshot=document.current_content,
        )
        self.db.add(version)
        self.db.add(document)
        self._commit_or_rollback()
        self.db.refresh(document)
        return document

    def delete_document(self, document: Document) -> None:
        self.db.delete(document)
        self._commit_or_rollback()

    def list_versions(self, document: Document) -> list[DocumentVersion]:
        statement = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document.id)
            .order_by(DocumentVersion.version_number.desc(), DocumentVersion.id.desc())
        )
        return list(self.db.scalars(statement))

    def _next_version_number(self, document_id: int) -> int:
        current_max = self.db.scalar(
            select(func.max(DocumentVersion.version_number)).where(
                DocumentVersion.document_id == document_id
            )
        )
        return 1 if current_max is None else current_max + 1

    def _commit_or_rollback(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The requested document change conflicts with existing data.",
            ) from exc
