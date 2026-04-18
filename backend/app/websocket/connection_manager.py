from __future__ import annotations

import asyncio
from dataclasses import dataclass

from fastapi import WebSocket

from app.models.document_permission import DocumentRole
from app.websocket.schemas import ActiveUserRead


@dataclass(slots=True)
class ManagedConnection:
    websocket: WebSocket
    user_id: int
    username: str
    role: DocumentRole


class ConnectionManager:
    """Track active document websocket connections in memory."""

    def __init__(self) -> None:
        self._connections: dict[int, dict[WebSocket, ManagedConnection]] = {}
        self._lock = asyncio.Lock()

    async def add_connection(
        self,
        *,
        document_id: int,
        websocket: WebSocket,
        user_id: int,
        username: str,
        role: DocumentRole,
    ) -> None:
        async with self._lock:
            document_connections = self._connections.setdefault(document_id, {})
            document_connections[websocket] = ManagedConnection(
                websocket=websocket,
                user_id=user_id,
                username=username,
                role=role,
            )

    async def remove_connection(self, *, document_id: int, websocket: WebSocket) -> bool:
        async with self._lock:
            document_connections = self._connections.get(document_id)
            if document_connections is None or websocket not in document_connections:
                return False

            document_connections.pop(websocket, None)
            if not document_connections:
                self._connections.pop(document_id, None)
            return True

    async def get_connections(self, document_id: int) -> list[ManagedConnection]:
        async with self._lock:
            document_connections = self._connections.get(document_id, {})
            return list(document_connections.values())

    async def get_active_users(self, document_id: int) -> list[ActiveUserRead]:
        connections = await self.get_connections(document_id)
        active_users_by_id: dict[int, ActiveUserRead] = {}
        for connection in connections:
            active_users_by_id.setdefault(
                connection.user_id,
                ActiveUserRead(
                    user_id=connection.user_id,
                    username=connection.username,
                ),
            )

        return sorted(
            active_users_by_id.values(),
            key=lambda active_user: (active_user.username.lower(), active_user.user_id),
        )

    def reset(self) -> None:
        self._connections.clear()
