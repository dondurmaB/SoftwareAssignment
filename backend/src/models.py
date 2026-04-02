from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class Role(str, Enum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class SaveType(str, Enum):
    manual = "manual"
    autosave = "autosave"


class DocumentDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    ownerUserId: str
    title: str
    currentContent: str
    latestVersionId: str | None
    createdAt: str
    updatedAt: str


class CreateDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    content: str


class UpdateDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    saveType: SaveType | None = None


def to_iso_string(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")
