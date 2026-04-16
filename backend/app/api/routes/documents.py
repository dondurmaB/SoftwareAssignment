from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.deps import (
    DocumentAccessContext,
    get_current_active_user,
    get_document_service,
    get_permission_service,
    require_document_owner,
    require_document_role,
)
from app.models.document import Document
from app.models.document_permission import DocumentRole
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.document import DocumentCreateRequest, DocumentListItem, DocumentRead, DocumentUpdateRequest
from app.schemas.permission import (
    DocumentPermissionRead,
    ShareDocumentRequest,
    UpdateDocumentPermissionRequest,
)
from app.schemas.version import DocumentRestoreResponse, DocumentVersionRead
from app.services.document_service import DocumentRestoreResult, DocumentService, DocumentVisibility
from app.services.permission_service import PermissionService, PermissionSubject

router = APIRouter(prefix="/api/documents", tags=["documents"])


def serialize_document_list_item(item: DocumentVisibility) -> DocumentListItem:
    document = item.document
    return DocumentListItem(
        id=document.id,
        title=document.title,
        owner_user_id=document.owner_user_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
        role=item.role,
    )


def serialize_document(document: Document, role: DocumentRole) -> DocumentRead:
    return DocumentRead(
        id=document.id,
        title=document.title,
        current_content=document.current_content,
        owner_user_id=document.owner_user_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
        role=role,
    )


def serialize_permission(permission: PermissionSubject) -> DocumentPermissionRead:
    return DocumentPermissionRead(
        user_id=permission.user.id,
        email=permission.user.email,
        username=permission.user.username,
        role=permission.role,
    )


def serialize_restore_result(result: DocumentRestoreResult) -> DocumentRestoreResponse:
    return DocumentRestoreResponse(
        id=result.document.id,
        title=result.document.title,
        current_content=result.document.current_content,
        updated_at=result.document.updated_at,
        new_version_number=result.version.version_number,
    )


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreateRequest,
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentRead:
    """Create a document owned by the current authenticated user."""

    created = document_service.create_document(current_user, payload)
    return serialize_document(created.document, created.role)


@router.get("", response_model=list[DocumentListItem])
def list_documents(
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> list[DocumentListItem]:
    """List documents owned by or shared with the current user."""

    documents = document_service.list_documents_for_user(current_user)
    return [serialize_document_list_item(item) for item in documents]


@router.get(
    "/{document_id}",
    response_model=DocumentRead,
)
def get_document(
    access: DocumentAccessContext = Depends(
        require_document_role(DocumentRole.owner, DocumentRole.editor, DocumentRole.viewer)
    ),
) -> DocumentRead:
    """Return document details and content for authorized users."""

    return serialize_document(access.document, access.role)


@router.put(
    "/{document_id}",
    response_model=DocumentRead,
)
def update_document(
    payload: DocumentUpdateRequest,
    access: DocumentAccessContext = Depends(
        require_document_role(DocumentRole.owner, DocumentRole.editor)
    ),
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentRead:
    """Update a document and append a version snapshot."""

    document = document_service.update_document(access.document, current_user, payload)
    return serialize_document(document, access.role)


@router.delete("/{document_id}", response_model=MessageResponse)
def delete_document(
    access: DocumentAccessContext = Depends(require_document_owner),
    document_service: DocumentService = Depends(get_document_service),
) -> MessageResponse:
    """Delete a document. Owner only."""

    document_service.delete_document(access.document)
    return MessageResponse(message="Document deleted successfully.")


@router.post("/{document_id}/share", response_model=DocumentPermissionRead)
def share_document(
    payload: ShareDocumentRequest,
    access: DocumentAccessContext = Depends(require_document_owner),
    current_user: User = Depends(get_current_active_user),
    permission_service: PermissionService = Depends(get_permission_service),
) -> DocumentPermissionRead:
    """Share a document with an existing user as editor or viewer."""

    permission = permission_service.share_document(access.document, current_user, payload)
    return serialize_permission(permission)


@router.get("/{document_id}/permissions", response_model=list[DocumentPermissionRead])
def list_permissions(
    access: DocumentAccessContext = Depends(require_document_owner),
    permission_service: PermissionService = Depends(get_permission_service),
) -> list[DocumentPermissionRead]:
    """List the owner and all shared document permissions."""

    permissions = permission_service.list_permissions(access.document)
    return [serialize_permission(permission) for permission in permissions]


@router.put("/{document_id}/permissions/{user_id}", response_model=DocumentPermissionRead)
def update_permission(
    user_id: int,
    payload: UpdateDocumentPermissionRequest,
    access: DocumentAccessContext = Depends(require_document_owner),
    permission_service: PermissionService = Depends(get_permission_service),
) -> DocumentPermissionRead:
    """Update a shared user's document role."""

    permission = permission_service.update_permission(access.document, user_id, payload)
    return serialize_permission(permission)


@router.delete("/{document_id}/permissions/{user_id}", response_model=MessageResponse)
def remove_permission(
    user_id: int,
    access: DocumentAccessContext = Depends(require_document_owner),
    permission_service: PermissionService = Depends(get_permission_service),
) -> MessageResponse:
    """Remove a non-owner user's access to the document."""

    permission_service.remove_permission(access.document, user_id)
    return MessageResponse(message="Document access removed successfully.")


@router.get(
    "/{document_id}/versions",
    response_model=list[DocumentVersionRead],
)
def list_versions(
    access: DocumentAccessContext = Depends(
        require_document_role(DocumentRole.owner, DocumentRole.editor)
    ),
    document_service: DocumentService = Depends(get_document_service),
) -> list[DocumentVersionRead]:
    """Return document version metadata for owner/editor roles."""

    versions = document_service.list_versions(access.document)
    latest_version_id = versions[0].id if versions else None
    return [
        DocumentVersionRead(
            id=version.id,
            version_number=version.version_number,
            created_by_user_id=version.created_by_user_id,
            created_at=version.created_at,
            is_current=version.id == latest_version_id,
        )
        for version in versions
    ]


@router.post(
    "/{document_id}/versions/{version_id}/restore",
    response_model=DocumentRestoreResponse,
)
def restore_version(
    version_id: int,
    access: DocumentAccessContext = Depends(require_document_owner),
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentRestoreResponse:
    """Restore a previous version by creating a new latest snapshot."""

    version = document_service.get_document_version_or_404(access.document, version_id)
    restored = document_service.restore_version(access.document, version, current_user)
    return serialize_restore_result(restored)
