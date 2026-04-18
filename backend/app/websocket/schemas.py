from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ValidationError

from app.models.document_permission import DocumentRole


class ActiveUserRead(BaseModel):
    user_id: int
    username: str


class JoinSessionMessage(BaseModel):
    type: Literal["join_session"]


class EditEventMessage(BaseModel):
    type: Literal["edit_event"]
    content: str


class PingMessage(BaseModel):
    type: Literal["ping"]


def parse_client_message(payload: object) -> JoinSessionMessage | EditEventMessage | PingMessage:
    if not isinstance(payload, dict):
        raise ValueError("WebSocket payload must be a JSON object.")

    message_type = payload.get("type")
    try:
        if message_type == "join_session":
            return JoinSessionMessage.model_validate(payload)
        if message_type == "edit_event":
            return EditEventMessage.model_validate(payload)
        if message_type == "ping":
            return PingMessage.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("Invalid websocket message payload.") from exc

    raise ValueError("Unknown message type.")


class SessionJoinedMessage(BaseModel):
    type: Literal["session_joined"] = "session_joined"
    document_id: int
    role: DocumentRole
    content: str
    active_users: list[ActiveUserRead]


class PresenceUpdateMessage(BaseModel):
    type: Literal["presence_update"] = "presence_update"
    active_users: list[ActiveUserRead]


class DocumentUpdateMessage(BaseModel):
    type: Literal["document_update"] = "document_update"
    document_id: int
    content: str
    updated_by_user_id: int


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    detail: str


class PongMessage(BaseModel):
    type: Literal["pong"] = "pong"
