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
from app.schemas.document import DocumentCreateRequest, DocumentSaveMode, DocumentUpdateRequest


@dataclass
class DocumentVisibility:
    document: Document
    role: DocumentRole


@dataclass
class DocumentRestoreResult:
    document: Document

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
        self.db.flush()

        initial_version = self._build_version_snapshot(
            document_id=document.id,
            created_by_user_id=owner.id,
            content_snapshot=document.current_content,
        )
        self.db.add(initial_version)
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
        title_changed = False
        content_changed = False
        content_provided = payload.content is not None

        if payload.title is not None:
            next_title = payload.title.strip()
            if next_title != document.title:
                document.title = next_title
                title_changed = True
        if content_provided and payload.content != document.current_content:
            document.current_content = payload.content
            content_changed = True

        create_version = self._should_create_version(
            save_mode=payload.save_mode,
            content_provided=content_provided,
        )

        if not title_changed and not content_changed and not create_version:
            return document

        now = utc_now()
        document.updated_at = now
        if create_version:
            self.db.add(
                self._build_version_snapshot(
                    document_id=document.id,
                    created_by_user_id=actor.id,
                    content_snapshot=document.current_content,
                    created_at=now,
                )
            )
        self.db.add(document)
        self._commit_or_rollback()
        self.db.refresh(document)
        return document

    def update_live_content(self, document: Document, content: str) -> Document:
        document.current_content = content
        document.updated_at = utc_now()
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

    def get_document_version_or_404(self, document: Document, version_id: int) -> DocumentVersion:
        statement = select(DocumentVersion).where(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == document.id,
        )
        version = self.db.scalar(statement)
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document version not found.",
            )
        return version

    def restore_version(
        self,
        document: Document,
        version: DocumentVersion,
        actor: User,
    ) -> DocumentRestoreResult:
        now = utc_now()
        document.current_content = version.content_snapshot
        document.updated_at = now

        self.db.add(
            self._build_version_snapshot(
                document_id=document.id,
                created_by_user_id=actor.id,
                content_snapshot=version.content_snapshot,
                created_at=now,
                restored_from_version_number=version.version_number,
            )
        )
        self.db.add(document)
        self._commit_or_rollback()
        self.db.refresh(document)
        return DocumentRestoreResult(document=document)

    def _next_version_number(self, document_id: int) -> int:
        current_max = self.db.scalar(
            select(func.max(DocumentVersion.version_number)).where(
                DocumentVersion.document_id == document_id
            )
        )
        return 1 if current_max is None else current_max + 1

    def _build_version_snapshot(
        self,
        *,
        document_id: int,
        created_by_user_id: int,
        content_snapshot: str,
        created_at=None,
        restored_from_version_number: int | None = None,
    ) -> DocumentVersion:
        return DocumentVersion(
            document_id=document_id,
            version_number=self._next_version_number(document_id),
            created_by_user_id=created_by_user_id,
            content_snapshot=content_snapshot,
            restored_from_version_number=restored_from_version_number,
            created_at=created_at or utc_now(),
        )

    def _should_create_version(self, *, save_mode: DocumentSaveMode, content_provided: bool) -> bool:
        if not content_provided:
            return False
        return save_mode in {"manual", "ai_apply"}

    def _commit_or_rollback(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The requested document change conflicts with existing data.",
            ) from exc
