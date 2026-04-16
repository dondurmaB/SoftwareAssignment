from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.security import utc_now

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    # Stores a hash of the issued refresh token, never the raw token itself.
    token: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean(), default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now, nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
