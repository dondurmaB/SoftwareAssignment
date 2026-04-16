from __future__ import annotations

import os
import uuid
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

TEST_DB_PATH = Path(__file__).resolve().parent / f"test_app_{uuid.uuid4().hex}.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "5"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"

from app.core.config import get_settings

get_settings.cache_clear()

from app.core.database import Base, SessionLocal, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def cleanup_database_file() -> Generator[None, None, None]:
    yield
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def auth_headers() -> Callable[[str], dict[str, str]]:
    def build_headers(access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}"}

    return build_headers


@pytest.fixture
def create_user(client: TestClient) -> Callable[..., dict[str, object]]:
    counter = {"value": 0}

    def create(
        *,
        email: str | None = None,
        username: str | None = None,
        password: str = "strongpass123",
    ) -> dict[str, object]:
        counter["value"] += 1
        suffix = counter["value"]
        response = client.post(
            "/api/auth/register",
            json={
                "email": email or f"user{suffix}@example.com",
                "username": username or f"user{suffix}",
                "password": password,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    return create
