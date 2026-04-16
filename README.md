# Collaborative Document Editor Monorepo

This repository started as an Assignment 1 proof of concept and is now being extended toward the final collaborative document editor with AI writing assistant described in the architecture report.

## Current Progress

- `frontend/` still contains the original React PoC client
- `backend/src/` still contains the original PoC FastAPI backend
- `backend/app/` contains the new implementation track for the final backend architecture
- Backend Milestone 1 is complete in `backend/app/`: authentication and session management

## Backend Milestone 1: Auth Module

Implemented in `backend/app/`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Included in this milestone:

- FastAPI modular backend structure aligned with the architecture
- Pydantic request/response validation
- SQLite + SQLAlchemy models for users and refresh tokens
- bcrypt password hashing via `passlib`
- stateless access JWTs
- server-side refresh token storage with revocation
- protected route dependency for current-user resolution
- pytest coverage for auth flows

## What This PoC Demonstrates

- Monorepo structure with `frontend/`, `backend/`, `shared/`, `docs/`, and `tests/`
- React + Vite + TypeScript frontend
- Python FastAPI backend
- Explicit DTO contracts shared through documentation and mirrored in code
- Working document creation, loading, and saving flow
- Initial milestone toward the final backend architecture

## Intentionally Not Implemented Yet

- AI assistance
- Real-time sync or collaborative editing
- Document CRUD in the new `backend/app/` implementation
- Document permissions and owner/editor/viewer enforcement
- Version history

These features remain in progress for the final assignment implementation.

## Folder Structure

```text
root/
  frontend/
  backend/
  shared/
  docs/
  tests/
  README.md
```

## Shared Contracts

The API contracts are documented in `shared/contracts.md`.

Implemented DTOs:

- `Role`: `owner | editor | viewer`
- `DocumentDto`
- `CreateDocumentRequest`
- `UpdateDocumentRequest`

## Backend Setup

1. Create and activate a virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy environment variables:

```bash
cp .env.example .env
```

4. Run the active FastAPI backend with uvicorn:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend endpoints:

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Run backend tests:

```bash
pytest app/tests/test_auth.py
```

Note:

- `backend/app/` is the active backend implementation path for new milestones
- `backend/src/` is the legacy PoC backend kept for reference during the transition

## Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the Vite development server:

```bash
npm run dev
```

The frontend expects the backend at `http://localhost:8000`.

## Running Both Services

Open two terminals.

Terminal 1:

```bash
cd backend
source .venv/bin/activate
uvicorn src.main:app --reload --port 8000
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Then open the frontend URL shown by Vite, typically `http://localhost:5173`.

## Example API Flow

1. Create document:
   Enter a title and content in the frontend, then click `Create Document`.
2. Load document:
   Paste or keep the returned document ID and click `Load Document`.
3. Save document:
   Update the content and click `Save Document`.

## Validation Goal

This repository currently validates:

- the original frontend-backend PoC flow
- the new backend authentication foundation for the final architecture

AI, version history, collaboration, and document permissions are the next milestones.
