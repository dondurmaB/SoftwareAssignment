from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.ai.cancellation import AICancellationRegistry
from app.core.database import get_db
from app.ai.mock_provider import MockAIProvider
from app.ai.provider import AIProvider
from app.models.document import Document
from app.models.document_permission import DocumentRole
from app.models.user import User
from app.services.ai_service import AIService
from app.services.auth_service import AuthService
from app.services.document_service import DocumentService
from app.services.permission_service import PermissionService
from app.websocket.collaboration_service import CollaborationService
from app.websocket.connection_manager import ConnectionManager

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_document_service(db: Session = Depends(get_db)) -> DocumentService:
    return DocumentService(db)


def get_permission_service(db: Session = Depends(get_db)) -> PermissionService:
    return PermissionService(db)


def get_ai_provider() -> AIProvider:
    return MockAIProvider()


@lru_cache
def get_ai_cancellation_registry() -> AICancellationRegistry:
    return AICancellationRegistry()


def get_ai_service(
    db: Session = Depends(get_db),
    ai_provider: AIProvider = Depends(get_ai_provider),
    cancellation_registry: AICancellationRegistry = Depends(get_ai_cancellation_registry),
) -> AIService:
    return AIService(db=db, provider=ai_provider, cancellation_registry=cancellation_registry)


@lru_cache
def get_connection_manager() -> ConnectionManager:
    return ConnectionManager()


def get_collaboration_service(
    document_service: DocumentService = Depends(get_document_service),
    connection_manager: ConnectionManager = Depends(get_connection_manager),
) -> CollaborationService:
    return CollaborationService(document_service=document_service, connection_manager=connection_manager)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the authenticated user from a bearer access token."""

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    return auth_service.get_user_from_access_token(credentials.credentials)


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Extension point for future disabled/suspended-user checks."""

    return current_user


def get_document_or_404(
    document_id: int,
    document_service: DocumentService = Depends(get_document_service),
) -> Document:
    return document_service.get_document_or_404(document_id)


def get_user_document_role(
    document: Document = Depends(get_document_or_404),
    current_user: User = Depends(get_current_active_user),
    permission_service: PermissionService = Depends(get_permission_service),
) -> DocumentRole | None:
    return permission_service.get_user_document_role(document, current_user)


@dataclass
class DocumentAccessContext:
    document: Document
    role: DocumentRole


def require_document_role(*allowed_roles: DocumentRole):
    def dependency(
        document: Document = Depends(get_document_or_404),
        current_user: User = Depends(get_current_active_user),
        permission_service: PermissionService = Depends(get_permission_service),
    ) -> DocumentAccessContext:
        role = permission_service.get_user_document_role(document, current_user)
        if role is None or role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this document.",
            )
        return DocumentAccessContext(document=document, role=role)

    return dependency


def require_document_owner(
    document: Document = Depends(get_document_or_404),
    current_user: User = Depends(get_current_active_user),
    permission_service: PermissionService = Depends(get_permission_service),
) -> DocumentAccessContext:
    role = permission_service.get_user_document_role(document, current_user)
    if role != DocumentRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the document owner can perform this action.",
        )
    return DocumentAccessContext(document=document, role=role)
