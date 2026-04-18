from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol

from app.models.ai_interaction import AIAction


class AIProvider(Protocol):
    """Streaming provider contract for AI text generation."""

    model_name: str

    async def stream_completion(
        self,
        *,
        action: AIAction,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        """Yield generated text chunks progressively."""

