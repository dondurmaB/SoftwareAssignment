from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: str
    type: Literal["access"]
    exp: int


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
