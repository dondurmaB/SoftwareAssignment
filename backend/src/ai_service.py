import uuid
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

from app.models.store import get_store, persist
from app.services.llm_provider import get_llm_provider
from app.prompts.templates import build_prompts

MAX_SELECTED_TEXT = 8000  # chars — truncate silently if longer

DAILY_LIMIT = int(__import__("os").getenv("AI_DAILY_LIMIT", "50"))


def _now():
    return datetime.now(timezone.utc).isoformat()


def _check_quota(user_id: str):
    """Raise if user exceeded daily AI request limit."""
    store = get_store()
    today = datetime.now(timezone.utc).date().isoformat()
    interactions = store["ai_interactions"]
    count = sum(
        1 for v in interactions.values()
        if v["user_id"] == user_id and v["created_at"][:10] == today
    )
    if count >= DAILY_LIMIT:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI quota exceeded ({DAILY_LIMIT} requests/day)",
            headers={"X-Quota-Status": "quota_exceeded"},
        )


def create_interaction(
    document_id: str,
    user_id: str,
    feature: str,
    selected_text: str,
    options: dict,
    model_name: str,
) -> str:
    """Persist an AIInteraction and return its id."""
    store = get_store()
    interaction_id = str(uuid.uuid4())
    interaction = {
        "id": interaction_id,
        "document_id": document_id,
        "user_id": user_id,
        "feature": feature,
        "selected_text": selected_text[:MAX_SELECTED_TEXT],
        "options": options,
        "model_name": model_name,
        "created_at": _now(),
        "suggestion_id": None,
    }
    store["ai_interactions"][interaction_id] = interaction
    store["doc_ai_interactions"].setdefault(document_id, []).append(interaction_id)
    persist()
    return interaction_id


def save_suggestion(interaction_id: str, suggested_text: str) -> str:
    """Save the completed AI suggestion and link to interaction."""
    store = get_store()
    suggestion_id = str(uuid.uuid4())
    suggestion = {
        "id": suggestion_id,
        "ai_interaction_id": interaction_id,
        "suggested_text": suggested_text,
        "decision_status": "pending",
    }
    store["ai_suggestions"][suggestion_id] = suggestion
    store["ai_interactions"][interaction_id]["suggestion_id"] = suggestion_id
    persist()
    return suggestion_id


def record_decision(suggestion_id: str, decision: str, edited_text: Optional[str] = None):
    store = get_store()
    suggestion = store["ai_suggestions"].get(suggestion_id)
    if not suggestion:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Suggestion not found")
    suggestion["decision_status"] = decision
    if edited_text is not None:
        suggestion["suggested_text"] = edited_text
    persist()


def get_document_history(document_id: str, user_id: str):
    from app.services.document_service import _require_role
    _require_role(document_id, user_id, "viewer")
    store = get_store()
    interaction_ids = store["doc_ai_interactions"].get(document_id, [])
    result = []
    for iid in reversed(interaction_ids):
        interaction = store["ai_interactions"].get(iid)
        if not interaction:
            continue
        suggestion = None
        if interaction.get("suggestion_id"):
            suggestion = store["ai_suggestions"].get(interaction["suggestion_id"])
        u = store["users"].get(interaction["user_id"], {})
        result.append({
            **interaction,
            "user_name": u.get("name", "Unknown"),
            "suggested_text": suggestion["suggested_text"] if suggestion else None,
            "decision_status": suggestion["decision_status"] if suggestion else None,
        })
    return result


async def stream_ai_response(
    document_id: str,
    user_id: str,
    feature: str,
    selected_text: str,
    options: dict,
) -> AsyncIterator[str]:
    """
    Core streaming generator.
    Yields SSE-formatted chunks, then a final [DONE] event with interaction_id + suggestion_id.
    """
    _check_quota(user_id)

    provider = get_llm_provider()
    model_name = getattr(provider, "model", "mock")

    # Truncate oversized input
    text = selected_text[:MAX_SELECTED_TEXT]

    system_prompt, user_prompt = build_prompts(feature, text, options)

    interaction_id = create_interaction(
        document_id, user_id, feature, text, options, model_name
    )

    full_response = []
    try:
        async for chunk in provider.astream(system_prompt, user_prompt):
            full_response.append(chunk)
            yield f"data: {chunk}\n\n"
    except Exception as e:
        yield f"event: error\ndata: {str(e)}\n\n"
        return

    # Save completed suggestion
    suggestion_id = save_suggestion(interaction_id, "".join(full_response))
    yield f"event: done\ndata: {{\"interaction_id\": \"{interaction_id}\", \"suggestion_id\": \"{suggestion_id}\"}}\n\n"
