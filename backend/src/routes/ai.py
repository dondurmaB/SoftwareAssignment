from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List

from app.models.schemas import AIRequest, SuggestionDecision
from app.services.auth_service import get_current_user
from app.services import ai_service, document_service as ds
from app.models.store import get_store

router = APIRouter()


@router.post("/stream", summary="Stream AI suggestion (SSE)")
async def stream_ai(body: AIRequest, current_user: dict = Depends(get_current_user)):
    """
    Submit an AI request. Response is a text/event-stream (SSE).
    Events:
      data: <chunk>        — text chunk
      event: error         — error message
      event: done          — JSON with interaction_id and suggestion_id
    """
    # Editors and owners can use AI; viewers cannot
    role = ds.get_user_role(body.document_id, current_user["id"])
    if role not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Viewers cannot use the AI assistant")

    async def generator():
        async for chunk in ai_service.stream_ai_response(
            document_id=body.document_id,
            user_id=current_user["id"],
            feature=body.feature,
            selected_text=body.selected_text,
            options=body.options or {},
        ):
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/suggestions/{suggestion_id}/decision", summary="Accept or reject an AI suggestion")
async def decide_suggestion(
    suggestion_id: str,
    body: SuggestionDecision,
    current_user: dict = Depends(get_current_user),
):
    store = get_store()
    suggestion = store["ai_suggestions"].get(suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    # Verify user has access to the document
    interaction = store["ai_interactions"].get(suggestion["ai_interaction_id"])
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    role = ds.get_user_role(interaction["document_id"], current_user["id"])
    if role not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Access denied")

    ai_service.record_decision(suggestion_id, body.decision, body.edited_text)
    return {"message": f"Suggestion {body.decision}"}


@router.get("/history/{document_id}", summary="Get AI interaction history for a document")
async def get_history(document_id: str, current_user: dict = Depends(get_current_user)):
    return ai_service.get_document_history(document_id, current_user["id"])
