# Shared Contracts

This file documents the active frontend-facing contract at a high level.

Source of truth:

- active backend implementation: `backend/app/`
- frontend types: `frontend/src/types/index.ts`

The original Assignment 1 PoC DTOs are no longer exhaustive for the merged application.

## Core Enums

### `Role`

- `owner`
- `editor`
- `viewer`

### `AIAction`

- `rewrite`
- `summarize`
- `translate`
- `enhance`

## Core Document Fields

The active frontend/backend contract uses snake_case document fields, including:

- `id`
- `title`
- `current_content`
- `owner_user_id`
- `created_at`
- `updated_at`
- `role`

## Active Backend Surface

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Documents

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

Document versioning notes:

- document creation creates version 1
- manual save and AI apply create new version entries
- autosave and live WebSocket typing update `current_content` without creating a new version on every tiny update
- restoring an older version creates a new version entry and records `restored_from_version_number`

### Collaboration

- `WS /ws/documents/{document_id}?token=<access_token>`

### AI

- `POST /api/ai/stream`
- `GET /api/ai/history/{document_id}`
- `POST /api/ai/suggestions/{suggestion_id}/decision`
- `POST /api/ai/interactions/{interaction_id}/cancel`

AI provider notes:

- `AI_PROVIDER` supports `mock`, `openai`, and `lmstudio`
- `mock` is the default local/test provider
- `openai` requires `OPENAI_API_KEY` and `OPENAI_MODEL`
- `lmstudio` requires `LMSTUDIO_MODEL`; `LMSTUDIO_BASE_URL` defaults to `http://localhost:1234/v1`

## Notes

- The backend is the source of truth for request/response shapes.
- Frontend AI integration is now wired to the active backend routes.
- Collaboration remains a baseline last-write-wins WebSocket implementation without CRDT/OT, offline merge/replay, or remote cursors.
- There is no document export/download endpoint in the current implementation.
- Partial acceptance and richer collaboration behavior are still intentionally out of scope.
