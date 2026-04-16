from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    utc_now,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, MessageResponse, RegisterRequest
from app.schemas.user import UserRead


class AuthService:
    """Authentication and session management for users."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()

    def register(self, payload: RegisterRequest) -> AuthResponse:
        email = str(payload.email).strip().lower()
        username = payload.username.strip()

        self._ensure_unique_user(email=email, username=username)

        user = User(
            email=email,
            username=username,
            password_hash=hash_password(payload.password),
        )
        self.db.add(user)
        self.db.flush()

        response = self._issue_tokens(user)
        self._commit_or_rollback()
        return response

    def login(self, payload: LoginRequest) -> AuthResponse:
        email = str(payload.email).strip().lower()
        user = self._get_user_by_email(email)

        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        response = self._issue_tokens(user)
        self._commit_or_rollback()
        return response

    def refresh(self, refresh_token: str) -> AuthResponse:
        token_record = self._get_valid_refresh_token(refresh_token)
        token_record.revoked = True

        response = self._issue_tokens(token_record.user)
        self._commit_or_rollback()
        return response

    def logout(self, refresh_token: str) -> MessageResponse:
        token_record = self._get_valid_refresh_token(refresh_token)
        token_record.revoked = True
        self._commit_or_rollback()
        return MessageResponse(message="Logout successful.")

    def get_user_from_access_token(self, access_token: str) -> User:
        payload = decode_access_token(access_token)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
            )

        try:
            user_id = int(payload.sub)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
            ) from exc

        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user no longer exists.",
            )

        return user

    def _issue_tokens(self, user: User) -> AuthResponse:
        refresh_token_value = generate_refresh_token()
        refresh_token_expires_at = utc_now() + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS)

        refresh_token = RefreshToken(
            user_id=user.id,
            token=hash_refresh_token(refresh_token_value),
            expires_at=refresh_token_expires_at,
        )
        self.db.add(refresh_token)
        self.db.flush()

        return AuthResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=refresh_token_value,
            user=UserRead.model_validate(user),
        )

    def _ensure_unique_user(self, *, email: str, username: str) -> None:
        if self._get_user_by_email(email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

        username_exists = self.db.scalar(select(User).where(User.username == username))
        if username_exists is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this username already exists.",
            )

    def _get_user_by_email(self, email: str) -> User | None:
        statement: Select[tuple[User]] = select(User).where(User.email == email)
        return self.db.scalar(statement)

    def _get_valid_refresh_token(self, token_value: str) -> RefreshToken:
        token_hash = hash_refresh_token(token_value)
        token_record = self.db.scalar(select(RefreshToken).where(RefreshToken.token == token_hash))
        if token_record is None or token_record.revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token.",
            )

        if token_record.expires_at <= utc_now():
            token_record.revoked = True
            self._commit_or_rollback()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired.",
            )

        return token_record

    def _commit_or_rollback(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The requested resource conflicts with existing data.",
            ) from exc
