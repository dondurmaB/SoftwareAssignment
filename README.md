# Collaborative Document Editor Monorepo

This repository started as an Assignment 1 proof of concept and is now being extended toward the final collaborative document editor with AI writing assistant described in the architecture report.

## Current Progress

- `frontend/` now contains the active React client with auth, document dashboard/editor flows, WebSocket collaboration baseline, and backend-backed AI integration
- `backend/src/` is the legacy PoC FastAPI backend kept only for reference
- `backend/app/` contains the new implementation track for the final backend architecture
- Backend Milestone 1 is complete in `backend/app/`: authentication and session management
- Backend Milestone 2 is complete in `backend/app/`: document management, sharing, RBAC, and version-history foundation
- Backend Milestone 2 follow-up is complete in `backend/app/`: explicit version checkpoints, restore audit trail, and version-history completion
- Backend Milestone 3 is complete in `backend/app/`: baseline authenticated WebSocket collaboration
- Backend Milestone 4 is complete in `backend/app/`: AI backend foundation with streaming, persisted history, and suggestion decision tracking
- Backend Milestone 4 follow-up is complete in `backend/app/`: cancellation support for in-progress AI interactions
- Backend Milestone 4 provider follow-up is complete in `backend/app/`: configurable mock/OpenAI/LM Studio provider support
- Backend Milestone 4 action follow-up is complete in `backend/app/`: `translate` and `enhance` support added to the active AI module

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

## Backend Milestone 2: Documents + Access Control

Implemented in `backend/app/`:

- `POST /api/documents`
- `GET /api/documents`
- `GET /api/documents/{id}`
- `PUT /api/documents/{id}`
- `DELETE /api/documents/{id}`
- `POST /api/documents/{id}/share`
- `GET /api/documents/{id}/permissions`
- `PUT /api/documents/{id}/permissions/{user_id}`
- `DELETE /api/documents/{id}/permissions/{user_id}`
- `GET /api/documents/{id}/versions`

Included in this milestone:

- SQLAlchemy models for documents, document permissions, and document versions
- Server-side document ownership and sharing rules
- Role-based access control with `owner`, `editor`, and `viewer`
- Reusable permission dependencies for route enforcement
- Document version-history foundation, later refined into explicit checkpoint creation for meaningful saves/restores
- pytest coverage for document CRUD, sharing, RBAC, and version-history foundation

## Backend Milestone 2 Follow-up: Versioning + Restore

Implemented in `backend/app/`:

- `POST /api/documents/{id}/versions/{version_id}/restore`

Included in this follow-up:

- Initial version snapshot creation at document creation time
- Explicit version checkpoints for manual save, AI apply, and restore
- Snapshot-based restore that appends a new version entry and records which earlier version it restored from
- Autosave and live collaboration updates that keep `current_content` fresh without creating a new version on every tiny change
- SQLite foreign key enforcement for stronger delete cascade safety

In other words: autosave keeps the live document content up to date, while explicit checkpoints are created only on document creation, manual save, AI apply, and restore.

## Backend Milestone 3: WebSocket Collaboration Baseline

Implemented in `backend/app/`:

- `WS /ws/documents/{document_id}?token=<access_token>`

Included in this milestone:

- Authenticated WebSocket document sessions
- Presence updates per document session
- Owner/editor live edit broadcast with viewer read-only enforcement
- Reconnect-safe latest-state sync from `document.current_content`
- pytest coverage for WebSocket auth, presence, and edit exchange

### Collaboration Baseline Note

- Collaboration currently uses authenticated WebSockets with last-write-wins full-content synchronization.
- CRDT/OT is intentionally not implemented in this version.
- This is acceptable for the assignment baseline, but concurrent edits can overwrite each other under contention.
- Live WebSocket edits update `current_content` only and do not create `DocumentVersion` snapshots.
- This is a deliberate design choice to avoid version spam during keystroke-level sync.
- Remote cursors are not implemented yet.
- Offline edit queueing is not implemented yet.
- Reconnect/offline merge resolution is not implemented beyond this baseline last-write-wins model.
- The current WebSocket service uses the existing synchronous SQLAlchemy session/service path inside async handlers; this is acceptable for assignment/demo scale, but not ideal for higher-concurrency production workloads.

## Backend Milestone 4: AI Backend Baseline

Implemented in `backend/app/`:

- `POST /api/ai/stream`
- `GET /api/ai/history/{document_id}`
- `POST /api/ai/suggestions/{suggestion_id}/decision`
- `POST /api/ai/interactions/{interaction_id}/cancel`

Included in this milestone:

- Provider abstraction with `mock`, `openai`, and `lmstudio` modes selected through configuration
- Configurable prompt templates for `rewrite`, `summarize`, `translate`, and `enhance`
- Authenticated AI access restricted to document `owner` and `editor`
- SSE-based `text/event-stream` response streaming
- Persistent `AIInteraction` and `AISuggestion` storage
- Suggestion decision tracking for `accepted` and `rejected`
- Cancellation support for in-progress AI interactions
- pytest coverage for streaming, failure handling, decision persistence, and cancellation behavior

### AI Backend Note

- The active AI backend currently supports `rewrite`, `summarize`, `translate`, and `enhance`.
- The backend supports `mock`, `openai`, and `lmstudio` providers selected through configuration.
- Mock is the default for local development and testing, and tests continue to use the mock provider override without making real external API calls.
- `OPENAI_API_KEY` and `OPENAI_MODEL` are only required when `AI_PROVIDER=openai`.
- `LMSTUDIO_MODEL` is required when `AI_PROVIDER=lmstudio`; `LMSTUDIO_BASE_URL` defaults to `http://localhost:1234/v1` and `LMSTUDIO_API_KEY` defaults to `lm-studio`.
- AI interactions and suggestions are persisted in the backend, including decision status and canceled interaction status.
- Real provider support exists in the backend, and the merged frontend now consumes the active AI backend endpoints.
- The frontend AI panel supports local request-abort cancel during streaming.
- Partial acceptance is not implemented.

## What This PoC Demonstrates

- Monorepo structure with `frontend/`, `backend/`, `shared/`, `docs/`, and `tests/`
- React + Vite + TypeScript frontend
- Python FastAPI backend
- Explicit DTO contracts shared through documentation and mirrored in code
- Working auth, document creation/loading/editing, and dashboard/editor flows
- Active backend milestones for auth, documents/permissions, version restore, WebSocket collaboration, and AI streaming foundation
- Frontend integration for AI streaming, history, and suggestion decisions against the active backend

## Intentionally Not Implemented Yet

- CRDT/OT conflict resolution
- Remote cursors
- Offline edit queueing
- Additional AI actions beyond the current `rewrite`, `summarize`, `translate`, and `enhance` set
- Advanced server-side/offline AI cancel orchestration beyond the current local stream-abort UI
- Document export/download
- Partial acceptance of AI suggestions

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

The active frontend/backend contract is documented in `shared/contracts.md`.
That file should be treated as the high-level contract reference for the final merged application.

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

4. Configure AI provider settings if needed:

- `AI_PROVIDER=mock|openai|lmstudio`
- default is `AI_PROVIDER=mock`
- when `AI_PROVIDER=openai`, set:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
- when `AI_PROVIDER=lmstudio`, set:
  - `LMSTUDIO_MODEL`
  - optionally override `LMSTUDIO_BASE_URL`
  - optionally override `LMSTUDIO_API_KEY`
- `.env.example` includes these backend AI provider variables

Optional one-command startup:

```bash
./run.sh --install
```

`./run.sh --install` is intended for local development/demo use. It:

- creates `backend/.venv` if it does not already exist
- installs backend dependencies into `backend/.venv`
- installs frontend dependencies in `frontend/`
- copies `backend/.env` from `backend/.env.example` if it is missing
- starts the backend on port `8000`
- starts the frontend on port `5173`

After that first run, you can use `./run.sh`, `./run.sh --backend-only`, or `./run.sh --frontend-only` as needed.

5. Run the active FastAPI backend with uvicorn:

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
- `POST /api/documents`
- `GET /api/documents`
- `GET /api/documents/{id}`
- `PUT /api/documents/{id}`
- `DELETE /api/documents/{id}`
- `POST /api/documents/{id}/share`
- `GET /api/documents/{id}/permissions`
- `PUT /api/documents/{id}/permissions/{user_id}`
- `DELETE /api/documents/{id}/permissions/{user_id}`
- `GET /api/documents/{id}/versions`
- `POST /api/documents/{id}/versions/{version_id}/restore`
- `WS /ws/documents/{document_id}?token=<access_token>`
- `POST /api/ai/stream`
- `GET /api/ai/history/{document_id}`
- `POST /api/ai/suggestions/{suggestion_id}/decision`
- `POST /api/ai/interactions/{interaction_id}/cancel`

Run backend tests:

```bash
pytest app/tests
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
uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Then open the frontend URL shown by Vite, typically `http://localhost:5173`.

## Example User Flow

1. Register or log in from the frontend auth pages.
2. Create a new document from the dashboard.
3. Open the document in the editor.
4. Type in the editor:
   autosave and live collaboration update `current_content`, but they do not create a new version entry on every small edit.
5. Click `Save version` when you want a checkpoint:
   this creates a new version entry in history.
6. Open the AI panel and run one of the supported actions:
   `rewrite`, `summarize`, `translate`, or `enhance`.
7. Accept or reject the AI suggestion:
   rejecting keeps the document unchanged, while accepting applies the text and creates a new version checkpoint.
8. Open version history to inspect saved checkpoints and restore an older version if needed.
9. Share the document with another user as `editor` or `viewer` and confirm baseline WebSocket collaboration works in the editor.

## Validation Goal

This repository currently validates:

- the merged frontend auth/dashboard/editor flow
- the new backend authentication foundation for the final architecture
- the new backend document management and access-control foundation
- backend versioning with explicit checkpoint creation for create/manual save/AI apply/restore
- baseline authenticated WebSocket collaboration
- backend AI streaming foundation with persisted history, decision tracking, and the current `rewrite` / `summarize` / `translate` / `enhance` action set
- backend AI interaction cancellation behavior
- backend AI provider selection with mock default and optional OpenAI/LM Studio support
- frontend integration for AI streaming, local stream cancel, history, and accept/reject decision flow

More advanced collaboration behavior, export, and richer AI UX remain future work.
