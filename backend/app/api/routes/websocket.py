from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, WebSocketException, status

from app.api.deps import (
    get_auth_service,
    get_collaboration_service,
    get_document_service,
    get_permission_service,
)
from app.models.document_permission import DocumentRole
from app.services.auth_service import AuthService
from app.services.document_service import DocumentService
from app.services.permission_service import PermissionService
from app.websocket.collaboration_service import CollaborationService
from app.websocket.schemas import EditEventMessage, JoinSessionMessage, PingMessage, parse_client_message

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/documents/{document_id}")
async def document_collaboration_websocket(
    websocket: WebSocket,
    document_id: int,
    token: str | None = Query(default=None),
    auth_service: AuthService = Depends(get_auth_service),
    document_service: DocumentService = Depends(get_document_service),
    permission_service: PermissionService = Depends(get_permission_service),
    collaboration_service: CollaborationService = Depends(get_collaboration_service),
) -> None:
    """Authenticate a document collaboration websocket and relay session events."""

    if not token:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Authentication token is required.",
        )

    try:
        current_user = auth_service.get_user_from_access_token(token)
    except HTTPException as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=str(exc.detail),
        ) from exc

    try:
        document = document_service.get_document_or_404(document_id)
    except HTTPException as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=str(exc.detail),
        ) from exc

    role = permission_service.get_user_document_role(document, current_user)
    if role is None:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="You do not have permission to access this document.",
        )

    await websocket.accept()

    joined = False
    try:
        while True:
            raw_message = await websocket.receive_text()

            try:
                payload = json.loads(raw_message)
            except json.JSONDecodeError:
                await collaboration_service.send_error(
                    websocket,
                    "Malformed JSON payload.",
                )
                continue

            try:
                message = parse_client_message(payload)
            except ValueError as exc:
                await collaboration_service.send_error(websocket, str(exc))
                continue

            if isinstance(message, JoinSessionMessage):
                if joined:
                    await collaboration_service.send_session_state(
                        websocket=websocket,
                        document_id=document_id,
                        role=role,
                    )
                else:
                    await collaboration_service.join_session(
                        websocket=websocket,
                        document_id=document_id,
                        user=current_user,
                        role=role,
                    )
                    joined = True
                continue

            if isinstance(message, PingMessage):
                await collaboration_service.send_pong(websocket)
                continue

            if isinstance(message, EditEventMessage):
                if not joined:
                    await collaboration_service.send_error(
                        websocket,
                        "Join the document session before sending edit events.",
                    )
                    continue

                await collaboration_service.process_edit_event(
                    websocket=websocket,
                    document_id=document_id,
                    user=current_user,
                    role=role,
                    content=message.content,
                )
    except WebSocketDisconnect:
        pass
    finally:
        if joined:
            await collaboration_service.leave_session(document_id=document_id, websocket=websocket)
