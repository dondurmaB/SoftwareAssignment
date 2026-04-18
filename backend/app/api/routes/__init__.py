from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.ai import router as ai_router
from app.api.routes.auth import router as auth_router
from app.api.routes.documents import router as documents_router
from app.api.routes.websocket import router as websocket_router

api_router = APIRouter()
api_router.include_router(ai_router)
api_router.include_router(auth_router)
api_router.include_router(documents_router)
api_router.include_router(websocket_router)

__all__ = ["api_router"]
