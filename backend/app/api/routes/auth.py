from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.deps import get_auth_service, get_current_active_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Create a user account and immediately issue tokens."""

    return auth_service.register(payload)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Authenticate a user and issue a fresh access/refresh token pair."""

    return auth_service.login(payload)


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    payload: RefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Rotate a refresh token and issue a new token pair."""

    return auth_service.refresh(payload.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(
    payload: LogoutRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    """Invalidate a refresh token without touching the stateless access token."""

    return auth_service.logout(payload.refresh_token)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_active_user)) -> UserRead:
    """Return the currently authenticated user."""

    return UserRead.model_validate(current_user)
