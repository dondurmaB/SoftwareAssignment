from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_permission import DocumentPermission, DocumentRole
from app.models.user import User
from app.schemas.permission import AssignableDocumentRole, ShareDocumentRequest, UpdateDocumentPermissionRequest


@dataclass
class PermissionSubject:
    user: User
    role: DocumentRole


class PermissionService:
    """Document sharing and role resolution logic."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user_document_role(self, document: Document, user: User) -> DocumentRole | None:
        if document.owner_user_id == user.id:
            return DocumentRole.owner

        permission = self.db.scalar(
            select(DocumentPermission.role).where(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == user.id,
            )
        )
        return permission

    def share_document(
        self,
        document: Document,
        owner: User,
        payload: ShareDocumentRequest,
    ) -> PermissionSubject:
        target_user = self._get_target_user(payload.identifier)
        if target_user.id == owner.id or target_user.id == document.owner_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owners cannot create redundant sharing permissions for themselves.",
            )

        permission = self.db.scalar(
            select(DocumentPermission).where(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == target_user.id,
            )
        )

        role = self._to_document_role(payload.role)
        if permission is None:
            permission = DocumentPermission(
                document_id=document.id,
                user_id=target_user.id,
                role=role,
            )
            self.db.add(permission)
        else:
            permission.role = role

        self._commit_or_rollback()
        return PermissionSubject(user=target_user, role=role)

    def list_permissions(self, document: Document) -> list[PermissionSubject]:
        owner = self.db.get(User, document.owner_user_id)
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document owner not found.",
            )

        statement: Select[tuple[User, DocumentRole]] = (
            select(User, DocumentPermission.role)
            .join(DocumentPermission, DocumentPermission.user_id == User.id)
            .where(DocumentPermission.document_id == document.id)
            .order_by(User.username.asc(), User.id.asc())
        )
        shared_users = [
            PermissionSubject(user=user, role=role)
            for user, role in self.db.execute(statement).all()
        ]
        return [PermissionSubject(user=owner, role=DocumentRole.owner), *shared_users]

    def update_permission(
        self,
        document: Document,
        user_id: int,
        payload: UpdateDocumentPermissionRequest,
    ) -> PermissionSubject:
        if user_id == document.owner_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner permissions cannot be modified through this route.",
            )

        permission = self.db.scalar(
            select(DocumentPermission).where(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == user_id,
            )
        )
        if permission is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document permission not found.",
            )

        target_user = self.db.get(User, user_id)
        if target_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        permission.role = self._to_document_role(payload.role)
        self._commit_or_rollback()
        return PermissionSubject(user=target_user, role=permission.role)

    def remove_permission(self, document: Document, user_id: int) -> None:
        if user_id == document.owner_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner access cannot be removed through this route.",
            )

        permission = self.db.scalar(
            select(DocumentPermission).where(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == user_id,
            )
        )
        if permission is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document permission not found.",
            )

        self.db.delete(permission)
        self._commit_or_rollback()

    def _get_target_user(self, identifier: str) -> User:
        normalized_identifier = identifier.strip()
        if not normalized_identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A target email or username is required.",
            )

        statement = select(User).where(
            or_(
                func.lower(User.email) == normalized_identifier.lower(),
                User.username == normalized_identifier,
            )
        )
        user = self.db.scalar(statement)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found.",
            )
        return user

    def _to_document_role(self, role: AssignableDocumentRole) -> DocumentRole:
        return DocumentRole(role.value)

    def _commit_or_rollback(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The requested permission change conflicts with existing data.",
            ) from exc
