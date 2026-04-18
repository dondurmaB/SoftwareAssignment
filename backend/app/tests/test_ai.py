from __future__ import annotations

import json
import threading
import time
from collections.abc import AsyncIterator, Callable, Generator

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_ai_cancellation_registry, get_ai_provider
from app.main import app
from app.models.ai_interaction import AIAction, AIInteraction, AIInteractionStatus
from app.models.ai_suggestion import AISuggestion, AISuggestionDecisionStatus


class TestMockAIProvider:
    model_name = "test-mock-provider"

    RESPONSES: dict[AIAction, list[str]] = {
        AIAction.rewrite: ["Better ", "rewritten ", "content."],
        AIAction.summarize: ["Brief ", "summary."],
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
            yield chunk


@pytest.fixture(autouse=True)
def override_ai_provider() -> Generator[None, None, None]:
    app.dependency_overrides[get_ai_provider] = lambda: TestMockAIProvider()
    yield
    app.dependency_overrides.pop(get_ai_provider, None)


@pytest.fixture(autouse=True)
def reset_ai_cancellation_registry() -> Generator[None, None, None]:
    registry = get_ai_cancellation_registry()
    registry.reset()
    yield
    registry.reset()


def create_document(
    client: TestClient,
    headers: dict[str, str],
    *,
    title: str = "AI document",
    content: str = "Original content for AI",
) -> dict[str, object]:
    response = client.post(
        "/api/documents",
        json={"title": title, "content": content},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def share_document(
    client: TestClient,
    owner_headers: dict[str, str],
    document_id: int,
    *,
    identifier: str,
    role: str,
) -> None:
    response = client.post(
        f"/api/documents/{document_id}/share",
        json={"identifier": identifier, "role": role},
        headers=owner_headers,
    )
    assert response.status_code == 200, response.text


def stream_ai_request(
    client: TestClient,
    headers: dict[str, str],
    *,
    document_id: int,
    action: str = "rewrite",
    selected_text: str = "Selected text for AI",
    options: dict[str, str] | None = None,
) -> tuple[int, list[str]]:
    with client.stream(
        "POST",
        "/api/ai/stream",
        headers=headers,
        json={
            "document_id": document_id,
            "action": action,
            "selected_text": selected_text,
            "options": options or {},
        },
    ) as response:
        lines = [line for line in response.iter_lines() if line]
        return response.status_code, lines


def parse_sse(lines: list[str]) -> tuple[list[str], dict[str, int] | None]:
    data_chunks: list[str] = []
    done_payload: dict[str, int] | None = None
    pending_event: str | None = None

    for line in lines:
        if line.startswith("event: "):
            pending_event = line.removeprefix("event: ")
            continue

        if not line.startswith("data: "):
            continue

        payload = line.removeprefix("data: ")
        if pending_event == "done":
            done_payload = json.loads(payload)
            pending_event = None
        else:
            data_chunks.append(payload)

    return data_chunks, done_payload


def parse_sse_with_events(lines: list[str]) -> tuple[list[str], dict[str, int] | None, list[str]]:
    data_chunks: list[str] = []
    done_payload: dict[str, int] | None = None
    error_payloads: list[str] = []
    pending_event: str | None = None

    for line in lines:
        if line.startswith("event: "):
            pending_event = line.removeprefix("event: ")
            continue

        if not line.startswith("data: "):
            continue

        payload = line.removeprefix("data: ")
        if pending_event == "done":
            done_payload = json.loads(payload)
        elif pending_event == "error":
            error_payloads.append(payload)
        else:
            data_chunks.append(payload)
        pending_event = None

    return data_chunks, done_payload, error_payloads


def parse_sse_full(
    lines: list[str],
) -> tuple[list[str], dict[str, int] | None, list[str], dict[str, int] | None]:
    data_chunks: list[str] = []
    done_payload: dict[str, int] | None = None
    error_payloads: list[str] = []
    canceled_payload: dict[str, int] | None = None
    pending_event: str | None = None

    for line in lines:
        if line.startswith("event: "):
            pending_event = line.removeprefix("event: ")
            continue

        if not line.startswith("data: "):
            continue

        payload = line.removeprefix("data: ")
        if pending_event == "done":
            done_payload = json.loads(payload)
        elif pending_event == "error":
            error_payloads.append(payload)
        elif pending_event == "canceled":
            canceled_payload = json.loads(payload)
        else:
            data_chunks.append(payload)
        pending_event = None

    return data_chunks, done_payload, error_payloads, canceled_payload


def create_suggestion(
    client: TestClient,
    headers: dict[str, str],
    *,
    document_id: int,
    action: str = "rewrite",
    selected_text: str = "Selected text for AI",
    options: dict[str, str] | None = None,
) -> dict[str, int]:
    status_code, lines = stream_ai_request(
        client,
        headers,
        document_id=document_id,
        action=action,
        selected_text=selected_text,
        options=options,
    )
    assert status_code == 200
    _, done_payload = parse_sse(lines)
    assert done_payload is not None
    return done_payload


def test_owner_can_invoke_ai_stream(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, auth_headers(owner["access_token"]))

    status_code, lines = stream_ai_request(
        client,
        auth_headers(owner["access_token"]),
        document_id=document["id"],
        action="rewrite",
    )

    assert status_code == 200
    chunks, done_payload = parse_sse(lines)
    assert len(chunks) > 1
    assert "".join(chunks) == "Better rewritten content."
    assert done_payload is not None


def test_editor_can_invoke_ai_stream(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers, title="Shared AI doc")
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    status_code, lines = stream_ai_request(
        client,
        auth_headers(editor["access_token"]),
        document_id=document["id"],
        action="summarize",
    )

    assert status_code == 200
    chunks, done_payload = parse_sse(lines)
    assert "".join(chunks) == "Brief summary."
    assert done_payload is not None


def test_viewer_cannot_invoke_ai(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    response = client.post(
        "/api/ai/stream",
        headers=auth_headers(viewer["access_token"]),
        json={
            "document_id": document["id"],
            "action": "rewrite",
            "selected_text": "Viewer request",
            "options": {},
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only owners and editors can use AI features for this document."


def test_invalid_document_access_is_blocked(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    outsider = create_user(email="outsider@example.com", username="outsider")
    document = create_document(client, auth_headers(owner["access_token"]))

    response = client.post(
        "/api/ai/stream",
        headers=auth_headers(outsider["access_token"]),
        json={
            "document_id": document["id"],
            "action": "rewrite",
            "selected_text": "Outsider request",
            "options": {},
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only owners and editors can use AI features for this document."


def test_stream_endpoint_returns_progressive_chunks_and_persists_history(
    client: TestClient,
    db_session,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, auth_headers(owner["access_token"]))

    status_code, lines = stream_ai_request(
        client,
        auth_headers(owner["access_token"]),
        document_id=document["id"],
        action="rewrite",
        selected_text="Improve this paragraph",
        options={"tone": "formal"},
    )

    assert status_code == 200
    chunks, done_payload = parse_sse(lines)
    assert chunks == ["Better ", "rewritten ", "content."]
    assert done_payload is not None

    interaction = db_session.get(AIInteraction, done_payload["interaction_id"])
    assert interaction is not None
    assert interaction.document_id == document["id"]
    assert interaction.user_id == owner["user"]["id"]
    assert interaction.action == AIAction.rewrite
    assert interaction.model_name == "test-mock-provider"
    assert interaction.status == AIInteractionStatus.completed
    assert "formal" in interaction.prompt_text

    suggestion = db_session.get(AISuggestion, done_payload["suggestion_id"])
    assert suggestion is not None
    assert suggestion.suggested_text == "Better rewritten content."
    assert suggestion.decision_status == AISuggestionDecisionStatus.pending


def test_history_endpoint_returns_persisted_interactions(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, auth_headers(owner["access_token"]))

    status_code, _ = stream_ai_request(
        client,
        auth_headers(owner["access_token"]),
        document_id=document["id"],
        action="summarize",
        selected_text="Summarize this longer selection",
        options={"length": "short"},
    )
    assert status_code == 200

    history_response = client.get(
        f"/api/ai/history/{document['id']}",
        headers=auth_headers(owner["access_token"]),
    )

    assert history_response.status_code == 200
    payload = history_response.json()
    assert len(payload) == 1
    item = payload[0]
    assert item["document_id"] == document["id"]
    assert item["user_id"] == owner["user"]["id"]
    assert item["username"] == owner["user"]["username"]
    assert item["action"] == "summarize"
    assert item["model_name"] == "test-mock-provider"
    assert item["status"] == "completed"
    assert item["suggested_text"] == "Brief summary."
    assert item["decision_status"] == "pending"


def test_stream_failure_marks_interaction_failed_and_returns_error_event(
    client: TestClient,
    db_session,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    class FailingAIProvider:
        model_name = "failing-test-provider"

        async def stream_completion(
            self,
            *,
            action: AIAction,
            system_prompt: str,
            user_prompt: str,
        ) -> AsyncIterator[str]:
            del action, system_prompt, user_prompt
            yield "Partial "
            raise RuntimeError("provider exploded")

    app.dependency_overrides[get_ai_provider] = lambda: FailingAIProvider()

    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, auth_headers(owner["access_token"]))

    status_code, lines = stream_ai_request(
        client,
        auth_headers(owner["access_token"]),
        document_id=document["id"],
        action="rewrite",
    )

    assert status_code == 200
    chunks, done_payload, error_payloads = parse_sse_with_events(lines)
    assert chunks == ["Partial "]
    assert done_payload is None
    assert error_payloads == ["AI generation failed."]

    interaction = db_session.query(AIInteraction).one()
    assert interaction.status == AIInteractionStatus.failed
    assert interaction.model_name == "failing-test-provider"
    suggestion = db_session.query(AISuggestion).filter_by(ai_interaction_id=interaction.id).one_or_none()
    assert suggestion is None

    app.dependency_overrides[get_ai_provider] = lambda: TestMockAIProvider()


def test_owner_can_mark_suggestion_accepted(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)
    suggestion_payload = create_suggestion(client, headers, document_id=document["id"])

    response = client.post(
        f"/api/ai/suggestions/{suggestion_payload['suggestion_id']}/decision",
        headers=headers,
        json={"decision": "accepted"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "suggestion_id": suggestion_payload["suggestion_id"],
        "interaction_id": suggestion_payload["interaction_id"],
        "decision_status": "accepted",
    }


def test_editor_can_mark_suggestion_rejected(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )
    suggestion_payload = create_suggestion(client, owner_headers, document_id=document["id"])

    response = client.post(
        f"/api/ai/suggestions/{suggestion_payload['suggestion_id']}/decision",
        headers=auth_headers(editor["access_token"]),
        json={"decision": "rejected"},
    )

    assert response.status_code == 200
    assert response.json()["decision_status"] == "rejected"


def test_viewer_cannot_update_suggestion_decision(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )
    suggestion_payload = create_suggestion(client, owner_headers, document_id=document["id"])

    response = client.post(
        f"/api/ai/suggestions/{suggestion_payload['suggestion_id']}/decision",
        headers=auth_headers(viewer["access_token"]),
        json={"decision": "accepted"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only owners and editors can update AI suggestion decisions for this document."


def test_outsider_cannot_update_suggestion_decision(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    outsider = create_user(email="outsider@example.com", username="outsider")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)
    suggestion_payload = create_suggestion(client, headers, document_id=document["id"])

    response = client.post(
        f"/api/ai/suggestions/{suggestion_payload['suggestion_id']}/decision",
        headers=auth_headers(outsider["access_token"]),
        json={"decision": "rejected"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only owners and editors can update AI suggestion decisions for this document."


def test_missing_suggestion_returns_404(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")

    response = client.post(
        "/api/ai/suggestions/999999/decision",
        headers=auth_headers(owner["access_token"]),
        json={"decision": "accepted"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "AI suggestion not found."


def test_history_reflects_updated_decision_status(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)
    suggestion_payload = create_suggestion(client, headers, document_id=document["id"])

    decision_response = client.post(
        f"/api/ai/suggestions/{suggestion_payload['suggestion_id']}/decision",
        headers=headers,
        json={"decision": "accepted"},
    )
    assert decision_response.status_code == 200

    history_response = client.get(f"/api/ai/history/{document['id']}", headers=headers)
    assert history_response.status_code == 200
    payload = history_response.json()
    assert len(payload) == 1
    assert payload[0]["suggestion_id"] == suggestion_payload["suggestion_id"]
    assert payload[0]["decision_status"] == "accepted"


def test_owner_can_cancel_in_progress_interaction(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.rewrite,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.in_progress,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "interaction_id": interaction.id,
        "status": "canceled",
    }


def test_completed_interaction_cannot_be_canceled(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)
    suggestion_payload = create_suggestion(client, headers, document_id=document["id"])

    response = client.post(
        f"/api/ai/interactions/{suggestion_payload['interaction_id']}/cancel",
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Completed AI interactions cannot be canceled."


def test_editor_can_cancel_in_progress_interaction_on_accessible_document(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.rewrite,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.in_progress,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=auth_headers(editor["access_token"]),
    )

    assert response.status_code == 200
    assert response.json() == {
        "interaction_id": interaction.id,
        "status": "canceled",
    }


def test_viewer_cannot_cancel_ai_interaction(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.rewrite,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.in_progress,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=auth_headers(viewer["access_token"]),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only owners and editors can cancel AI interactions for this document."


def test_outsider_cannot_cancel_ai_interaction(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    outsider = create_user(email="outsider@example.com", username="outsider")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.rewrite,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.in_progress,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=auth_headers(outsider["access_token"]),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only owners and editors can cancel AI interactions for this document."


def test_missing_interaction_returns_404(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")

    response = client.post(
        "/api/ai/interactions/999999/cancel",
        headers=auth_headers(owner["access_token"]),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "AI interaction not found."


def test_failed_interaction_cannot_be_canceled(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.rewrite,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.failed,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Failed AI interactions cannot be canceled."


def test_canceled_interaction_appears_in_history_with_canceled_status(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.summarize,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.in_progress,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    cancel_response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=headers,
    )
    assert cancel_response.status_code == 200

    history_response = client.get(f"/api/ai/history/{document['id']}", headers=headers)
    assert history_response.status_code == 200
    payload = history_response.json()
    assert len(payload) == 1
    assert payload[0]["interaction_id"] == interaction.id
    assert payload[0]["status"] == "canceled"
    assert payload[0]["suggestion_id"] is None


def test_already_canceled_interaction_is_handled_gracefully(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    interaction = AIInteraction(
        document_id=document["id"],
        user_id=owner["user"]["id"],
        action=AIAction.rewrite,
        selected_text="Selected text",
        prompt_text="Prompt text",
        model_name="test-mock-provider",
        status=AIInteractionStatus.canceled,
    )
    db_session.add(interaction)
    db_session.commit()
    db_session.refresh(interaction)

    response = client.post(
        f"/api/ai/interactions/{interaction.id}/cancel",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "interaction_id": interaction.id,
        "status": "canceled",
    }


def test_canceling_mid_stream_prevents_final_suggestion_persistence_and_emits_canceled_event(
    client: TestClient,
    db_session,
    auth_headers: Callable[[str], dict[str, str]],
    create_user: Callable[..., dict[str, object]],
) -> None:
    first_chunk_ready = threading.Event()
    continue_stream = threading.Event()
    stream_finished = threading.Event()
    stream_result: dict[str, object] = {}

    class SlowAIProvider:
        model_name = "slow-test-provider"

        async def stream_completion(
            self,
            *,
            action: AIAction,
            system_prompt: str,
            user_prompt: str,
        ) -> AsyncIterator[str]:
            del action, system_prompt, user_prompt
            yield "First "
            first_chunk_ready.set()
            while not continue_stream.is_set():
                await __import__("asyncio").sleep(0.01)
            yield "Second "

    app.dependency_overrides[get_ai_provider] = lambda: SlowAIProvider()

    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    def consume_stream() -> None:
        with TestClient(app) as stream_client:
            with stream_client.stream(
                "POST",
                "/api/ai/stream",
                headers=headers,
                json={
                    "document_id": document["id"],
                    "action": "rewrite",
                    "selected_text": "Selected text for cancellation",
                    "options": {},
                },
            ) as response:
                lines = [line for line in response.iter_lines() if line]
                stream_result["status_code"] = response.status_code
                stream_result["lines"] = lines
        stream_finished.set()

    stream_thread = threading.Thread(target=consume_stream, daemon=True)
    stream_thread.start()

    assert first_chunk_ready.wait(timeout=5)

    interaction_id: int | None = None
    for _ in range(50):
        db_session.expire_all()
        interaction = db_session.query(AIInteraction).filter_by(document_id=document["id"]).one_or_none()
        if interaction is not None:
            interaction_id = interaction.id
            break
        time.sleep(0.05)

    assert interaction_id is not None

    cancel_response = client.post(
        f"/api/ai/interactions/{interaction_id}/cancel",
        headers=headers,
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "canceled"

    continue_stream.set()
    assert stream_finished.wait(timeout=5)
    stream_thread.join(timeout=5)

    assert stream_result["status_code"] == 200
    chunks, done_payload, error_payloads, canceled_payload = parse_sse_full(stream_result["lines"])  # type: ignore[arg-type]
    assert chunks == ["First "]
    assert done_payload is None
    assert error_payloads == []
    assert canceled_payload == {"interaction_id": interaction_id}

    db_session.expire_all()
    interaction = db_session.get(AIInteraction, interaction_id)
    assert interaction is not None
    assert interaction.status == AIInteractionStatus.canceled
    suggestion = db_session.query(AISuggestion).filter_by(ai_interaction_id=interaction_id).one_or_none()
    assert suggestion is None

    app.dependency_overrides[get_ai_provider] = lambda: TestMockAIProvider()
