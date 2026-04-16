from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.document_permission import DocumentPermission
from app.models.document_version import DocumentVersion


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
    assert len(versions) == 2
    assert [version["version_number"] for version in versions] == [2, 1]
    assert versions[0]["created_by_user_id"] == owner["user"]["id"]
    assert versions[0]["is_current"] is True
    assert versions[1]["is_current"] is False


def test_create_document_produces_initial_version_entry(
    client: TestClient,
    db_session,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user()
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="Initial body")

    versions_response = client.get(f"/api/documents/{document['id']}/versions", headers=headers)
    assert versions_response.status_code == 200
    versions = versions_response.json()

    assert len(versions) == 1
    assert versions[0]["version_number"] == 1
    assert versions[0]["created_by_user_id"] == owner["user"]["id"]
    assert versions[0]["is_current"] is True

    initial_version = db_session.scalar(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document["id"],
            DocumentVersion.version_number == 1,
        )
    )
    assert initial_version is not None
    assert initial_version.content_snapshot == "Initial body"

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{versions[0]['id']}/restore",
        headers=headers,
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["current_content"] == "Initial body"


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


def test_deleting_document_removes_related_versions_and_permissions(
    client: TestClient,
    db_session,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    shared = create_user(email="shared@example.com", username="shared")
    owner_headers = auth_headers(owner["access_token"])
    document = create_document(client, owner_headers, content="base")

    client.put(f"/api/documents/{document['id']}", json={"content": "updated"}, headers=owner_headers)
    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="shared@example.com",
        role="viewer",
    )

    delete_response = client.delete(f"/api/documents/{document['id']}", headers=owner_headers)
    assert delete_response.status_code == 200

    version = db_session.scalar(
        select(DocumentVersion).where(DocumentVersion.document_id == document["id"])
    )
    permission = db_session.scalar(
        select(DocumentPermission).where(DocumentPermission.document_id == document["id"])
    )
    assert version is None
    assert permission is None


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


def test_owner_can_restore_version(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="v0")

    client.put(
        f"/api/documents/{document['id']}",
        json={"content": "v1"},
        headers=headers,
    )
    client.put(
        f"/api/documents/{document['id']}",
        json={"content": "v2"},
        headers=headers,
    )

    versions_response = client.get(f"/api/documents/{document['id']}/versions", headers=headers)
    version_to_restore = next(version for version in versions_response.json() if version["version_number"] == 1)

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{version_to_restore['id']}/restore",
        headers=headers,
    )

    assert restore_response.status_code == 200
    assert restore_response.json()["id"] == document["id"]


def test_restore_updates_document_content_correctly(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="draft")

    client.put(f"/api/documents/{document['id']}", json={"content": "first"}, headers=headers)
    client.put(f"/api/documents/{document['id']}", json={"content": "second"}, headers=headers)
    versions = client.get(f"/api/documents/{document['id']}/versions", headers=headers).json()
    version_to_restore = next(version for version in versions if version["version_number"] == 1)

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{version_to_restore['id']}/restore",
        headers=headers,
    )

    assert restore_response.status_code == 200
    assert restore_response.json()["current_content"] == "draft"

    document_response = client.get(f"/api/documents/{document['id']}", headers=headers)
    assert document_response.status_code == 200
    assert document_response.json()["current_content"] == "draft"


def test_restore_creates_new_version_snapshot(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="base")

    client.put(f"/api/documents/{document['id']}", json={"content": "v1"}, headers=headers)
    client.put(f"/api/documents/{document['id']}", json={"content": "v2"}, headers=headers)
    versions = client.get(f"/api/documents/{document['id']}/versions", headers=headers).json()
    version_to_restore = next(version for version in versions if version["version_number"] == 1)

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{version_to_restore['id']}/restore",
        headers=headers,
    )
    assert restore_response.status_code == 200

    versions_after_restore = client.get(f"/api/documents/{document['id']}/versions", headers=headers)
    assert versions_after_restore.status_code == 200
    payload = versions_after_restore.json()
    assert len(payload) == 4
    assert payload[0]["version_number"] == 4
    assert payload[0]["is_current"] is True


def test_restore_version_numbers_increment_correctly(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="base")

    client.put(f"/api/documents/{document['id']}", json={"content": "v1"}, headers=headers)
    client.put(f"/api/documents/{document['id']}", json={"content": "v2"}, headers=headers)
    versions = client.get(f"/api/documents/{document['id']}/versions", headers=headers).json()
    version_to_restore = next(version for version in versions if version["version_number"] == 1)

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{version_to_restore['id']}/restore",
        headers=headers,
    )

    assert restore_response.status_code == 200
    assert restore_response.json()["new_version_number"] == 4


def test_editor_cannot_restore(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    editor = create_user(email="editor@example.com", username="editor")
    owner_headers = auth_headers(owner["access_token"])
    editor_headers = auth_headers(editor["access_token"])
    document = create_document(client, owner_headers, content="base")

    client.put(f"/api/documents/{document['id']}", json={"content": "v1"}, headers=owner_headers)
    version = client.get(f"/api/documents/{document['id']}/versions", headers=owner_headers).json()[0]

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="editor@example.com",
        role="editor",
    )

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{version['id']}/restore",
        headers=editor_headers,
    )

    assert restore_response.status_code == 403


def test_viewer_cannot_restore(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    viewer = create_user(email="viewer@example.com", username="viewer")
    owner_headers = auth_headers(owner["access_token"])
    viewer_headers = auth_headers(viewer["access_token"])
    document = create_document(client, owner_headers, content="base")

    client.put(f"/api/documents/{document['id']}", json={"content": "v1"}, headers=owner_headers)
    version = client.get(f"/api/documents/{document['id']}/versions", headers=owner_headers).json()[0]

    share_document(
        client,
        owner_headers,
        document["id"],
        identifier="viewer@example.com",
        role="viewer",
    )

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/{version['id']}/restore",
        headers=viewer_headers,
    )

    assert restore_response.status_code == 403


def test_restoring_non_existing_version_returns_404(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="base")

    restore_response = client.post(
        f"/api/documents/{document['id']}/versions/999999/restore",
        headers=headers,
    )

    assert restore_response.status_code == 404


def test_restoring_version_from_another_document_is_blocked(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    first_document = create_document(client, headers, content="first-base")
    second_document = create_document(client, headers, content="second-base")

    client.put(f"/api/documents/{first_document['id']}", json={"content": "first-v1"}, headers=headers)
    client.put(f"/api/documents/{second_document['id']}", json={"content": "second-v1"}, headers=headers)
    second_document_version = client.get(
        f"/api/documents/{second_document['id']}/versions",
        headers=headers,
    ).json()[0]

    restore_response = client.post(
        f"/api/documents/{first_document['id']}/versions/{second_document_version['id']}/restore",
        headers=headers,
    )

    assert restore_response.status_code == 404


def test_get_versions_shows_correct_order_and_latest_version(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    owner = create_user(email="owner@example.com", username="owner")
    headers = auth_headers(owner["access_token"])
    document = create_document(client, headers, content="base")

    client.put(f"/api/documents/{document['id']}", json={"content": "v1"}, headers=headers)
    client.put(f"/api/documents/{document['id']}", json={"content": "v2"}, headers=headers)

    versions_response = client.get(f"/api/documents/{document['id']}/versions", headers=headers)
    assert versions_response.status_code == 200
    versions = versions_response.json()

    assert [version["version_number"] for version in versions] == [3, 2, 1]
    assert versions[0]["is_current"] is True
    assert versions[1]["is_current"] is False
    assert versions[2]["is_current"] is False
