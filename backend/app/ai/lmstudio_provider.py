from __future__ import annotations

from app.ai.openai_provider import OpenAIProvider


class LMStudioProvider(OpenAIProvider):
    """OpenAI-compatible provider for a local LM Studio server."""

    def __init__(self, *, api_key: str, model_name: str, base_url: str) -> None:
        super().__init__(
            api_key=api_key,
            model_name=model_name,
            base_url=base_url,
            provider_name="lmstudio",
        )
