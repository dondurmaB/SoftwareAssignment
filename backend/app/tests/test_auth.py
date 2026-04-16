from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

TEST_DB_PATH = Path(__file__).resolve().parent / f"test_auth_{uuid.uuid4().hex}.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "5"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"

from app.core.config import get_settings

get_settings.cache_clear()

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models.refresh_token import RefreshToken


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module", autouse=True)
def cleanup_database_file() -> Generator[None, None, None]:
    yield
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def register_user(
    client: TestClient,
    *,
    email: str = "alice@example.com",
    username: str = "alice",
    password: str = "strongpass123",
) -> dict[str, object]:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "username": username,
            "password": password,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_registration(client: TestClient) -> None:
    payload = register_user(client)

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


def test_login(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "strongpass123"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "alice@example.com"
    assert payload["access_token"]
    assert payload["refresh_token"]


def test_invalid_login(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_refresh_rotates_refresh_token(client: TestClient) -> None:
    payload = register_user(client)
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


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    register_payload = register_user(client)
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


def test_protected_route_access(client: TestClient) -> None:
    unauthorized_response = client.get("/api/auth/me")
    assert unauthorized_response.status_code == 401
    assert unauthorized_response.json()["detail"] == "Authentication credentials were not provided."

    payload = register_user(client)
    access_token = payload["access_token"]

    authorized_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
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
