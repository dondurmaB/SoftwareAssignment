from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.ai.provider import AIProvider
from app.models.ai_interaction import AIAction


class MockAIProvider(AIProvider):
    """Deterministic streaming provider for local development and tests."""

    model_name = "mock-writing-assistant-v1"

    RESPONSES: dict[AIAction, list[str]] = {
        AIAction.rewrite: [
            "This ",
            "rewritten ",
            "version ",
            "improves ",
            "clarity ",
            "while ",
            "preserving ",
            "the ",
            "original ",
            "meaning.",
        ],
        AIAction.summarize: [
            "This ",
            "summary ",
            "captures ",
            "the ",
            "main ",
            "idea ",
            "and ",
            "key ",
            "supporting ",
            "points.",
        ],
    }

    async def stream_completion(
        self,
        *,
        action: AIAction,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        del system_prompt, user_prompt

        for chunk in self.RESPONSES[action]:
            await asyncio.sleep(0)
            yield chunk
