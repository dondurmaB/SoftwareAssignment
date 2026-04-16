"""
LLM provider abstraction layer.
Swapping providers = change only this file (or set LLM_PROVIDER env var).
"""
import os
import asyncio
from typing import AsyncIterator

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")  # openai | mock
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class LLMProvider:
    """Abstract base — all providers implement astream()."""

    async def astream(self, system: str, user: str) -> AsyncIterator[str]:
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    def __init__(self):
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            self.model = OPENAI_MODEL
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")

    async def astream(self, system: str, user: str) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            stream=True,
            max_tokens=2048,
            temperature=0.7,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


class MockProvider(LLMProvider):
    """Returns a canned streamed response. Useful for dev/testing without an API key."""

    RESPONSES = {
        "rewrite": "Here is a rewritten version of your text with improved clarity and flow. The core ideas have been preserved while the language has been refined.",
        "summarize": "**Summary:** This text covers the main topic with several key points. The author argues for a structured approach and provides supporting evidence.",
        "translate": "Voici le texte traduit en français. (This is a mock translation — set OPENAI_API_KEY for real translations.)",
        "enhance": "• **Point 1:** Enhanced version of your first idea\n• **Point 2:** Improved structure for readability\n• **Point 3:** Cleaner formatting applied",
        "grammar": "Here is the corrected version of your text with grammar and spelling issues fixed.",
        "custom": "Here is the result of applying your custom instruction to the selected text.",
    }

    async def astream(self, system: str, user: str) -> AsyncIterator[str]:
        # detect feature from system prompt
        feature = "rewrite"
        for key in self.RESPONSES:
            if key in system.lower():
                feature = key
                break
        response = self.RESPONSES.get(feature, self.RESPONSES["rewrite"])
        for word in response.split(" "):
            yield word + " "
            await asyncio.sleep(0.04)  # simulate streaming delay


def get_llm_provider() -> LLMProvider:
    if LLM_PROVIDER == "mock" or not OPENAI_API_KEY:
        return MockProvider()
    elif LLM_PROVIDER == "openai":
        return OpenAIProvider()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER}")
