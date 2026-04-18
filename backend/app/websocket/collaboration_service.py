from __future__ import annotations

from fastapi import WebSocket

from app.models.document_permission import DocumentRole
from app.models.user import User
from app.services.document_service import DocumentService
from app.websocket.connection_manager import ConnectionManager
from app.websocket.schemas import (
    DocumentUpdateMessage,
    ErrorMessage,
    PongMessage,
    PresenceUpdateMessage,
    SessionJoinedMessage,
)


class CollaborationService:
    """Join/leave/broadcast logic for baseline document collaboration."""

    def __init__(
        self,
        *,
        document_service: DocumentService,
        connection_manager: ConnectionManager,
    ) -> None:
        self.document_service = document_service
        self.connection_manager = connection_manager

    async def join_session(
        self,
        *,
        websocket: WebSocket,
        document_id: int,
        user: User,
        role: DocumentRole,
    ) -> None:
        await self.connection_manager.add_connection(
            document_id=document_id,
            websocket=websocket,
            user_id=user.id,
            username=user.username,
            role=role,
        )

        try:
            await self.send_session_state(
                websocket=websocket,
                document_id=document_id,
                role=role,
            )
        except Exception:
            await self.connection_manager.remove_connection(document_id=document_id, websocket=websocket)
            raise

        await self.broadcast_presence(document_id=document_id, exclude_websockets={websocket})

    async def leave_session(self, *, document_id: int, websocket: WebSocket) -> None:
        removed = await self.connection_manager.remove_connection(
            document_id=document_id,
            websocket=websocket,
        )
        if removed:
            await self.broadcast_presence(document_id=document_id)

    async def send_session_state(
        self,
        *,
        websocket: WebSocket,
        document_id: int,
        role: DocumentRole,
    ) -> None:
        document = self.document_service.get_document_or_404(document_id)
        active_users = await self.connection_manager.get_active_users(document_id)
        payload = SessionJoinedMessage(
            document_id=document.id,
            role=role,
            content=document.current_content,
            active_users=active_users,
        )
        await websocket.send_json(payload.model_dump(mode="json"))

    async def broadcast_presence(
        self,
        *,
        document_id: int,
        exclude_websockets: set[WebSocket] | None = None,
    ) -> None:
        active_users = await self.connection_manager.get_active_users(document_id)
        payload = PresenceUpdateMessage(active_users=active_users)
        await self._broadcast(
            document_id=document_id,
            payload=payload.model_dump(mode="json"),
            exclude_websockets=exclude_websockets,
        )

    async def process_edit_event(
        self,
        *,
        websocket: WebSocket,
        document_id: int,
        user: User,
        role: DocumentRole,
        content: str,
    ) -> None:
        if role == DocumentRole.viewer:
            await self.send_error(websocket, "Viewers cannot edit this document.")
            return

        document = self.document_service.get_document_or_404(document_id)
        updated_document = self.document_service.update_live_content(document, content)

        payload = DocumentUpdateMessage(
            document_id=updated_document.id,
            content=updated_document.current_content,
            updated_by_user_id=user.id,
        )
        await self._broadcast(
            document_id=document_id,
            payload=payload.model_dump(mode="json"),
            exclude_websockets={websocket},
        )

    async def send_error(self, websocket: WebSocket, detail: str) -> None:
        payload = ErrorMessage(detail=detail)
        await websocket.send_json(payload.model_dump(mode="json"))

    async def send_pong(self, websocket: WebSocket) -> None:
        await websocket.send_json(PongMessage().model_dump(mode="json"))

    async def _broadcast(
        self,
        *,
        document_id: int,
        payload: dict[str, object],
        exclude_websockets: set[WebSocket] | None = None,
    ) -> None:
        exclude_websockets = exclude_websockets or set()
        connections = await self.connection_manager.get_connections(document_id)
        stale_websockets: list[WebSocket] = []

        for connection in connections:
            if connection.websocket in exclude_websockets:
                continue

            try:
                await connection.websocket.send_json(payload)
            except Exception:
                stale_websockets.append(connection.websocket)

        for stale_websocket in stale_websockets:
            await self.connection_manager.remove_connection(
                document_id=document_id,
                websocket=stale_websocket,
            )
