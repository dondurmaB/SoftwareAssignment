from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.security import utc_now

if TYPE_CHECKING:
    from app.models.ai_suggestion import AISuggestion
    from app.models.document import Document
    from app.models.user import User


class AIAction(str, Enum):
    rewrite = "rewrite"
    summarize = "summarize"


class AIInteractionStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    canceled = "canceled"


class AIInteraction(Base):
    __tablename__ = "ai_interactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    action: Mapped[AIAction] = mapped_column(
        SqlEnum(AIAction, name="ai_action", native_enum=False),
        nullable=False,
    )
    selected_text: Mapped[str] = mapped_column(Text(), nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text(), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[AIInteractionStatus] = mapped_column(
        SqlEnum(AIInteractionStatus, name="ai_interaction_status", native_enum=False),
        default=AIInteractionStatus.in_progress,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now, nullable=False)

    document: Mapped["Document"] = relationship(back_populates="ai_interactions")
    user: Mapped["User"] = relationship(back_populates="ai_interactions")
    suggestion: Mapped["AISuggestion | None"] = relationship(
        back_populates="interaction",
        cascade="all, delete-orphan",
        uselist=False,
    )
