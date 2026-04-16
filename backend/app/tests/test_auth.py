from __future__ import annotations

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.refresh_token import RefreshToken


def test_registration(client: TestClient, create_user: Callable[..., dict[str, object]]) -> None:
    payload = create_user(email="alice@example.com", username="alice")

    assert payload["token_type"] == "bearer"
    assert payload["user"]["email"] == "alice@example.com"
    assert payload["user"]["username"] == "alice"
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert "password_hash" not in payload["user"]

    with SessionLocal() as db:
        stored_refresh_token = db.scalar(select(RefreshToken))

    assert stored_refresh_token is not None
    assert stored_refresh_token.token != payload["refresh_token"]


def test_login(client: TestClient, create_user: Callable[..., dict[str, object]]) -> None:
    create_user(email="alice@example.com", username="alice")

    response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "strongpass123"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "alice@example.com"
    assert payload["access_token"]
    assert payload["refresh_token"]


def test_invalid_login(client: TestClient, create_user: Callable[..., dict[str, object]]) -> None:
    create_user(email="alice@example.com", username="alice")

    response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_refresh_rotates_refresh_token(client: TestClient, create_user: Callable[..., dict[str, object]]) -> None:
    payload = create_user(email="alice@example.com", username="alice")
    original_refresh_token = payload["refresh_token"]

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )

    assert refresh_response.status_code == 200
    refreshed_payload = refresh_response.json()
    assert refreshed_payload["refresh_token"] != original_refresh_token
    assert refreshed_payload["access_token"] != payload["access_token"]

    reused_token_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )

    assert reused_token_response.status_code == 401
    assert reused_token_response.json()["detail"] == "Invalid refresh token."


def test_logout_revokes_refresh_token(client: TestClient, create_user: Callable[..., dict[str, object]]) -> None:
    register_payload = create_user(email="alice@example.com", username="alice")
    refresh_token = register_payload["refresh_token"]

    login_response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "strongpass123"},
    )
    assert login_response.status_code == 200
    second_refresh_token = login_response.json()["refresh_token"]

    logout_response = client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh_token},
    )

    assert logout_response.status_code == 200
    assert logout_response.json()["message"] == "Logout successful."

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == 401
    assert refresh_response.json()["detail"] == "Invalid refresh token."

    second_refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": second_refresh_token},
    )

    assert second_refresh_response.status_code == 200


def test_protected_route_access(
    client: TestClient,
    create_user: Callable[..., dict[str, object]],
    auth_headers: Callable[[str], dict[str, str]],
) -> None:
    unauthorized_response = client.get("/api/auth/me")
    assert unauthorized_response.status_code == 401
    assert unauthorized_response.json()["detail"] == "Authentication credentials were not provided."

    payload = create_user(email="alice@example.com", username="alice")
    access_token = payload["access_token"]

    authorized_response = client.get(
        "/api/auth/me",
        headers=auth_headers(access_token),
    )

    assert authorized_response.status_code == 200
    assert authorized_response.json()["email"] == "alice@example.com"


def test_invalid_payload_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "username": "ab", "password": "short"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid request payload."
