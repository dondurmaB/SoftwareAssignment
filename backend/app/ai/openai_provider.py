from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover - exercised through runtime configuration checks
    AsyncOpenAI = None  # type: ignore[assignment]

from app.ai.provider import AIProvider
from app.models.ai_interaction import AIAction


class OpenAIProvider(AIProvider):
    """Real AI provider backed by the OpenAI Python SDK."""

    def __init__(
        self,
        *,
        api_key: str,
        model_name: str,
        base_url: str | None = None,
        provider_name: str = "openai",
    ) -> None:
        if AsyncOpenAI is None:
            raise RuntimeError(
                f"AI_PROVIDER={provider_name} requires the 'openai' package to be installed."
            )

        self.model_name = model_name
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def stream_completion(
        self,
        *,
        action: AIAction,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        del action

        stream = await self._client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
        )

        async for chunk in stream:
            delta = self._extract_delta(chunk)
            if delta:
                yield delta

    @staticmethod
    def _extract_delta(chunk: Any) -> str:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            return ""

        delta = getattr(choices[0], "delta", None)
        content = getattr(delta, "content", None)
        return content if isinstance(content, str) else ""
