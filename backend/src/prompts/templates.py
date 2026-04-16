"""
Prompt templates for all AI features.
Templates live here — update wording without touching business logic.
"""
from typing import Dict, Tuple


SYSTEM_TEMPLATES: Dict[str, str] = {
    "rewrite": (
        "You are a professional writing assistant. Rewrite the provided text "
        "to be clearer, more engaging, and well-structured. "
        "Tone: {tone}. Preserve the original meaning and length approximately. "
        "Return only the rewritten text, no preamble."
    ),
    "summarize": (
        "You are a concise summarizer. Summarize the provided text. "
        "Target length: {length} (short ≈ 1–2 sentences, medium ≈ 1 paragraph, long ≈ several paragraphs). "
        "Format: {format}. Return only the summary, no preamble."
    ),
    "translate": (
        "You are a professional translator. Translate the provided text into {target_language}. "
        "Preserve formatting, tone, and structure. Return only the translated text."
    ),
    "enhance": (
        "You are a writing enhancer. Improve the provided text by: "
        "converting prose to bullet points if requested, improving logical structure, "
        "varying sentence length, and strengthening word choice. "
        "Return only the enhanced text."
    ),
    "grammar": (
        "You are a grammar and spelling checker. Fix all grammatical errors, spelling mistakes, "
        "punctuation issues, and awkward phrasing in the provided text. "
        "Make minimal changes beyond corrections. Return only the corrected text."
    ),
    "custom": (
        "You are a helpful writing assistant. Apply the following instruction to the text: "
        "{instruction}. Return only the result, no preamble."
    ),
}

USER_TEMPLATE = "Text to process:\n\n{selected_text}"


def build_prompts(feature: str, selected_text: str, options: dict) -> Tuple[str, str]:
    """Return (system_prompt, user_prompt) for a given feature + options."""
    system_tpl = SYSTEM_TEMPLATES.get(feature, SYSTEM_TEMPLATES["custom"])

    # Fill template placeholders with options or sensible defaults
    defaults = {
        "tone": options.get("tone", "professional"),
        "length": options.get("length", "medium"),
        "format": options.get("format", "prose"),
        "target_language": options.get("target_language", "French"),
        "instruction": options.get("instruction", "Improve this text"),
    }
    try:
        system_prompt = system_tpl.format(**defaults)
    except KeyError:
        system_prompt = system_tpl  # leave unfilled placeholders as-is

    user_prompt = USER_TEMPLATE.format(selected_text=selected_text)
    return system_prompt, user_prompt
