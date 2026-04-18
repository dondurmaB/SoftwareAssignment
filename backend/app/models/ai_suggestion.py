from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.security import utc_now

if TYPE_CHECKING:
    from app.models.ai_interaction import AIInteraction


class AISuggestionDecisionStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"
    __table_args__ = (
        UniqueConstraint("ai_interaction_id", name="uq_ai_suggestions_interaction"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ai_interaction_id: Mapped[int] = mapped_column(
        ForeignKey("ai_interactions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    suggested_text: Mapped[str] = mapped_column(Text(), nullable=False)
    decision_status: Mapped[AISuggestionDecisionStatus] = mapped_column(
        SqlEnum(AISuggestionDecisionStatus, name="ai_suggestion_decision_status", native_enum=False),
        default=AISuggestionDecisionStatus.pending,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now, onupdate=utc_now, nullable=False)

    interaction: Mapped["AIInteraction"] = relationship(back_populates="suggestion")
