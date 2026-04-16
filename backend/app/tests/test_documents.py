from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient


def create_document(
    client: TestClient,
    headers: dict[str, str],
    *,
    title: str = "My document",
    content: str = "Initial content",
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
) -> dict[str, object]:
    response = client.post(
        f"/api/documents/{document_id}/share",
        json={"identifier": identifier, "role": role},
        headers=owner_headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_authenticated_user_can_create_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user()
    response = client.post(
        "/api/documents",
        json={"title": "Project plan", "content": "Draft body"},
        headers=auth_headers(owner["access_token"]),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["title"] == "Project plan"
    assert payload["current_content"] == "Draft body"


def test_creator_becomes_owner(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user()
    document = create_document(client, auth_headers(owner["access_token"]))

    assert document["owner_user_id"] == owner["user"]["id"]
    assert document["role"] == "owner"


def test_owner_can_list_and_fetch_owned_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user()
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, title="Owned doc")

    list_response = client.get("/api/documents", headers=headers)
    assert list_response.status_code == 200
    listed_ids = {item["id"] for item in list_response.json()}
    assert document["id"] in listed_ids

    get_response = client.get(f"/api/documents/{document['id']}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Owned doc"
    assert get_response.json()["role"] == "owner"


def test_owner_can_update_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user()
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    update_response = client.put(
        f"/api/documents/{document['id']}",
        json={"title": "Updated title", "content": "Updated body"},
        headers=headers,
    )

    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["title"] == "Updated title"
    assert payload["current_content"] == "Updated body"


def test_update_creates_version_snapshot(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user()
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers)

    update_response = client.put(
        f"/api/documents/{document['id']}",
        json={"content": "Versioned content"},
        headers=headers,
    )
    assert update_response.status_code == 200

    versions_response = client.get(f"/api/documents/{document['id']}/versions", headers=headers)
    assert versions_response.status_code == 200
    versions = versions_response.json()
    assert len(versions) == 1
    assert versions[0]["version_number"] == 1
    assert versions[0]["created_by_user_id"] == owner["user"]["id"]


def test_viewer_cannot_update_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = auth_headers(owner["access_token"])
    viewer_headers = auth_headers(viewer["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    update_response = client.put(
        f"/api/documents/{document['id']}",
        json={"content": "Viewer edit attempt"},
        headers=viewer_headers,
    )

    assert update_response.status_code == 403


def test_editor_can_update_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = auth_headers(owner["access_token"])
    editor_headers = auth_headers(editor["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor",
        role="editor",
    )

    update_response = client.put(
        f"/api/documents/{document['id']}",
        json={"content": "Editor updated content"},
        headers=editor_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["current_content"] == "Editor updated content"


def test_owner_can_share_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    target = create_user(email="collab@example.com", username="collab")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)

    share_response = client.post(
        f"/api/documents/{document['id']}/share",
        json={"identifier": "collab@example.com", "role": "viewer"},
        headers=owner_headers,
    )

    assert share_response.status_code == 200
    payload = share_response.json()
    assert payload["user_id"] == target["user"]["id"]
    assert payload["role"] == "viewer"


def test_non_owner_cannot_share_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    target = create_user(email="target@example.com", username="target")
    owner_headers = auth_headers(owner["access_token"])
    editor_headers = auth_headers(editor["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    share_response = client.post(
        f"/api/documents/{document['id']}/share",
        json={"identifier": "target@example.com", "role": "viewer"},
        headers=editor_headers,
    )

    assert share_response.status_code == 403
    assert target["user"]["id"] is not None


def test_owner_can_list_permissions(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer",
        role="viewer",
    )

    permissions_response = client.get(
        f"/api/documents/{document['id']}/permissions",
        headers=owner_headers,
    )

    assert permissions_response.status_code == 200
    permissions = permissions_response.json()
    roles_by_user = {item["user_id"]: item["role"] for item in permissions}
    assert roles_by_user[owner["user"]["id"]] == "owner"
    assert roles_by_user[viewer["user"]["id"]] == "viewer"


def test_owner_can_update_shared_role(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    shared = create_user(email="shared@example.com", username="shared")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="shared@example.com",
        role="viewer",
    )

    update_response = client.put(
        f"/api/documents/{document['id']}/permissions/{shared['user']['id']}",
        json={"role": "editor"},
        headers=owner_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["role"] == "editor"


def test_owner_can_remove_shared_access(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    shared = create_user(email="shared@example.com", username="shared")
    owner_headers = auth_headers(owner["access_token"])
    shared_headers = auth_headers(shared["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="shared",
        role="viewer",
    )

    delete_response = client.delete(
        f"/api/documents/{document['id']}/permissions/{shared['user']['id']}",
        headers=owner_headers,
    )

    assert delete_response.status_code == 200

    get_response = client.get(f"/api/documents/{document['id']}", headers=shared_headers)
    assert get_response.status_code == 403


def test_non_owner_cannot_delete_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = auth_headers(owner["access_token"])
    editor_headers = auth_headers(editor["access_token"])
    document = create_document(client, owner_headers)

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor",
        role="editor",
    )

    delete_response = client.delete(f"/api/documents/{document['id']}", headers=editor_headers)
    assert delete_response.status_code == 403


def test_owner_can_delete_document(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers)

    delete_response = client.delete(f"/api/documents/{document['id']}", headers=owner_headers)
    assert delete_response.status_code == 200

    get_response = client.get(f"/api/documents/{document['id']}", headers=owner_headers)
    assert get_response.status_code == 404


def test_inaccessible_document_returns_correct_status(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    outsider = create_user(email="outsider@example.com", username="outsider")
    owner_headers = auth_headers(owner["access_token"])
    outsider_headers = auth_headers(outsider["access_token"])
    document = create_document(client, owner_headers)

    get_response = client.get(f"/api/documents/{document['id']}", headers=outsider_headers)
    assert get_response.status_code == 403


def test_documents_list_only_returns_visible_documents(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    recipient = create_user(email="recipient@example.com", username="recipient")
    third_user = create_user(email="third@example.com", username="third")
    owner_headers = auth_headers(owner["access_token"])
    recipient_headers = auth_headers(recipient["access_token"])
    third_headers = auth_headers(third_user["access_token"])

    shared_document = create_document(client, owner_headers, title="Shared")
    create_document(client, owner_headers, title="Private owner doc")
    own_document = create_document(client, recipient_headers, title="Recipient own doc")
    create_document(client, third_headers, title="Third user doc")

    share_document(
        client,
        owner_headers,
        shared_document["id"],
        identifier="recipient@example.com",
        role="viewer",
    )

    list_response = client.get("/api/documents", headers=recipient_headers)
    assert list_response.status_code == 200

    visible_titles = {item["title"] for item in list_response.json()}
    assert "Shared" in visible_titles
    assert own_document["title"] in visible_titles
    assert "Private owner doc" not in visible_titles
    assert "Third user doc" not in visible_titles
