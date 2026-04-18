from __future__ import annotations

from dataclasses import dataclass

from app.models.ai_interaction import AIAction


@dataclass(frozen=True)
class PromptSet:
    system_prompt: str
    user_prompt: str

    @property
    def prompt_text(self) -> str:
        return f"SYSTEM:\n{self.system_prompt}\n\nUSER:\n{self.user_prompt}"


def build_prompt_set(action: AIAction, selected_text: str, options: dict[str, str]) -> PromptSet:
    if action == AIAction.rewrite:
        tone = options.get("tone", "professional")
        system_prompt = (
            "You are a professional writing assistant. Rewrite the provided text "
            f"to improve clarity, structure, and flow. Keep the tone {tone}. "
            "Preserve the original meaning and return only the rewritten text."
        )
    elif action == AIAction.summarize:
        length = options.get("length", "medium")
        system_prompt = (
            "You are a concise summarizer. Summarize the provided text and preserve "
            f"the important ideas. Target summary length: {length}. "
            "Return only the summary."
        )
    else:
        raise ValueError(f"Unsupported AI action: {action}")

    user_prompt = f"Selected text:\n\n{selected_text}"
    return PromptSet(system_prompt=system_prompt, user_prompt=user_prompt)
