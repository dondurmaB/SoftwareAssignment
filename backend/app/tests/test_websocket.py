from __future__ import annotations

from collections.abc import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api.deps import get_connection_manager
from app.models.document import Document
from app.models.document_permission import DocumentRole


@pytest.fixture(autouse=True)
def reset_connection_manager() -> Generator[None, None, None]:
    manager = get_connection_manager()
    manager.reset()
    yield
    manager.reset()


def create_document(
    client: TestClient,
    headers: dict[str, str],
    *,
    title: str = "Realtime doc",
    content: str = "Initial collaborative content",
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


def websocket_url(document_id: int, token: str) -> str:
    return f"/ws/documents/{document_id}?token={token}"


def assert_active_user_ids(payload: dict[str, object], expected_ids: list[int]) -> None:
    active_users = payload["active_users"]
    assert isinstance(active_users, list)
    actual_ids = sorted(user["user_id"] for user in active_users)
    assert actual_ids == sorted(expected_ids)


def test_valid_authenticated_user_can_connect_to_accessible_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as websocket:
        websocket.send_json({"type": "join_session"})
        payload = websocket.receive_json()

        assert payload["type"] == "session_joined"
        assert payload["document_id"] == document["id"]
        assert payload["role"] == DocumentRole.owner.value
        assert payload["content"] == document["current_content"]
        assert_active_user_ids(payload, [owner["user"]["id"]])


def test_invalid_token_connection_is_rejected(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(websocket_url(document["id"], "invalid-token")):
            pass


def test_unauthorized_user_cannot_connect(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    outsider = create_user(email="outsider@example.com", username="outsider")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(websocket_url(document["id"], outsider["access_token"])):
            pass


def test_ping_returns_pong(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as websocket:
        websocket.send_json({"type": "join_session"})
        websocket.receive_json()

        websocket.send_json({"type": "ping"})
        payload = websocket.receive_json()

        assert payload == {"type": "pong"}


def test_malformed_json_returns_error(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as websocket:
        websocket.send_text("{bad json")
        payload = websocket.receive_json()

        assert payload["type"] == "error"
        assert payload["detail"] == "Malformed JSON payload."


def test_unknown_message_type_returns_error(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as websocket:
        websocket.send_json({"type": "something_else"})
        payload = websocket.receive_json()

        assert payload["type"] == "error"
        assert payload["detail"] == "Unknown message type."


def test_edit_event_before_join_session_returns_error(
    client: TestClient,
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    document = create_document(client, {"Authorization": f"Bearer {owner['access_token']}"})

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as websocket:
        websocket.send_json({"type": "edit_event", "content": "Oops"})
        payload = websocket.receive_json()

        assert payload["type"] == "error"
        assert payload["detail"] == "Join the document session before sending edit events."

    db_session.expire_all()
    refreshed_document = db_session.get(Document, document["id"])
    assert refreshed_document is not None
    assert refreshed_document.current_content == document["current_content"]


def test_viewer_can_connect_but_cannot_edit(
    client: TestClient,
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    with client.websocket_connect(websocket_url(document["id"], viewer["access_token"])) as websocket:
        websocket.send_json({"type": "join_session"})
        joined_payload = websocket.receive_json()
        assert joined_payload["role"] == DocumentRole.viewer.value

        websocket.send_json({"type": "edit_event", "content": "Viewer edit"})
        error_payload = websocket.receive_json()

        assert error_payload["type"] == "error"
        assert error_payload["detail"] == "Viewers cannot edit this document."

    db_session.expire_all()
    refreshed_document = db_session.get(Document, document["id"])
    assert refreshed_document is not None
    assert refreshed_document.current_content == document["current_content"]


def test_editor_can_connect_and_send_edit_event(
    client: TestClient,
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    with client.websocket_connect(websocket_url(document["id"], editor["access_token"])) as websocket:
        websocket.send_json({"type": "join_session"})
        websocket.receive_json()
        websocket.send_json({"type": "edit_event", "content": "Editor updated content"})

    db_session.expire_all()
    refreshed_document = db_session.get(Document, document["id"])
    assert refreshed_document is not None
    assert refreshed_document.current_content == "Editor updated content"


def test_edit_event_updates_document_content(
    client: TestClient,
    db_session,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    with client.websocket_connect(websocket_url(document["id"], editor["access_token"])) as websocket:
        websocket.send_json({"type": "join_session"})
        websocket.receive_json()
        websocket.send_json({"type": "edit_event", "content": "New live content"})

    db_session.expire_all()
    refreshed_document = db_session.get(Document, document["id"])
    assert refreshed_document is not None
    assert refreshed_document.current_content == "New live content"


def test_second_connected_user_receives_document_update(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as owner_socket:
        owner_socket.send_json({"type": "join_session"})
        owner_socket.receive_json()

        with client.websocket_connect(websocket_url(document["id"], editor["access_token"])) as editor_socket:
            editor_socket.send_json({"type": "join_session"})
            editor_socket.receive_json()

            presence_payload = owner_socket.receive_json()
            assert presence_payload["type"] == "presence_update"
            assert_active_user_ids(presence_payload, [owner["user"]["id"], editor["user"]["id"]])

            editor_socket.send_json({"type": "edit_event", "content": "Broadcast live update"})
            update_payload = owner_socket.receive_json()

            assert update_payload["type"] == "document_update"
            assert update_payload["document_id"] == document["id"]
            assert update_payload["content"] == "Broadcast live update"
            assert update_payload["updated_by_user_id"] == editor["user"]["id"]


def test_presence_update_is_sent_when_another_user_joins(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as owner_socket:
        owner_socket.send_json({"type": "join_session"})
        owner_socket.receive_json()

        with client.websocket_connect(websocket_url(document["id"], viewer["access_token"])) as viewer_socket:
            viewer_socket.send_json({"type": "join_session"})
            viewer_socket.receive_json()

            presence_payload = owner_socket.receive_json()
            assert presence_payload["type"] == "presence_update"
            assert_active_user_ids(presence_payload, [owner["user"]["id"], viewer["user"]["id"]])


def test_latest_document_content_is_sent_on_join_session(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers, content="Initial state")
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    with client.websocket_connect(websocket_url(document["id"], editor["access_token"])) as editor_socket:
        editor_socket.send_json({"type": "join_session"})
        editor_socket.receive_json()
        editor_socket.send_json({"type": "edit_event", "content": "Most recent collaborative content"})

    with client.websocket_connect(websocket_url(document["id"], viewer["access_token"])) as viewer_socket:
        viewer_socket.send_json({"type": "join_session"})
        joined_payload = viewer_socket.receive_json()

        assert joined_payload["type"] == "session_joined"
        assert joined_payload["content"] == "Most recent collaborative content"
        assert joined_payload["role"] == DocumentRole.viewer.value


def test_disconnect_updates_presence_correctly(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    document = create_document(client, owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    with client.websocket_connect(websocket_url(document["id"], owner["access_token"])) as owner_socket:
        owner_socket.send_json({"type": "join_session"})
        owner_socket.receive_json()

        with client.websocket_connect(websocket_url(document["id"], editor["access_token"])) as editor_socket:
            editor_socket.send_json({"type": "join_session"})
            editor_socket.receive_json()
            owner_socket.receive_json()

        disconnect_presence = owner_socket.receive_json()
        assert disconnect_presence["type"] == "presence_update"
        assert_active_user_ids(disconnect_presence, [owner["user"]["id"]])
