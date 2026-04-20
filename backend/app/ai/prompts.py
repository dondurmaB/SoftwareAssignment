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
    output_rule = (
        "Output only the final transformed text. Do not add any introduction, commentary, explanation, "
        "title, label, or note such as 'Here is the revised version'. Do not wrap the whole answer in "
        "quotation marks unless the original content itself requires them."
    )

    if action == AIAction.rewrite:
        tone = options.get("tone", "professional")
        system_prompt = (
            "You are a professional writing assistant. Rewrite the provided text "
            f"to improve clarity, structure, and flow. Keep the tone {tone}. "
            f"Preserve the original meaning. {output_rule}"
        )
    elif action == AIAction.summarize:
        length = options.get("length", "medium")
        length_targets = {
            "short": "Use 1 sentence when possible and keep it under 35 words.",
            "medium": "Use no more than 2 short sentences and keep it under 60 words.",
            "long": "Use no more than 3 concise sentences and keep it under 100 words.",
        }
        length_instruction = length_targets.get(
            length,
            "Use no more than 2 short sentences and keep it under 60 words.",
        )
        system_prompt = (
            "You are an aggressive summarizer. Compress the provided text to only its core point or points. "
            "Remove repetition, filler, examples, background detail, and softening language. "
            f"{length_instruction} {output_rule}"
        )
    elif action == AIAction.translate:
        target_language = options.get("target_language", "English")
        system_prompt = (
            "You are a professional translator. Translate the provided text faithfully "
            f"into {target_language}. Preserve the original meaning and nuance where possible. "
            f"{output_rule}"
        )
    elif action == AIAction.enhance:
        instruction = options.get("instruction")
        style = options.get("style")
        if instruction:
            system_prompt = (
                "You are an expert writing assistant. Enhance the provided text according "
                f"to this instruction: {instruction}. Preserve the original meaning unless "
                f"the instruction requires a stylistic change. {output_rule}"
            )
        elif style:
            system_prompt = (
                "You are an expert writing assistant. Improve the provided text for clarity, "
                f"grammar, and structure using a {style} style. Preserve the original meaning "
                f"and preserve the intended message. {output_rule}"
            )
        else:
            system_prompt = (
                "You are an expert writing assistant. Improve the provided text for clarity, "
                f"grammar, and structure while preserving the original meaning. {output_rule}"
            )
    else:
        raise ValueError(f"Unsupported AI action: {action}")

    user_prompt = f"Selected text:\n\n{selected_text}"
    return PromptSet(system_prompt=system_prompt, user_prompt=user_prompt)
