# CollabDocs — Collaborative Document Editor with AI Writing Assistant

A real-time collaborative document editor built with **React + FastAPI**, featuring JWT authentication, WebSocket-based live editing, and an SSE-streamed AI writing assistant.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/dondurmaB/SoftwareAssignment
cd SoftwareAssignment

# 2. Install all dependencies
./run.sh --install

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env:
#   AI_PROVIDER=mock   (no API key needed — streams realistic mock responses)
#   AI_PROVIDER=openai + OPENAI_API_KEY=sk-... (real AI)

# 4. Start both servers
./run.sh
```

Open **http://localhost:5173** in your browser.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

---

## Running Tests

### Backend (pytest)

```bash
cd backend
pip install -r requirements.txt
python -m pytest app/tests/ -v
```

### Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm install
npm test
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
SECRET_KEY=change-me-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
DATABASE_URL=sqlite:///./app.db

# AI: "mock" streams canned responses without an API key
# "openai" requires OPENAI_API_KEY and OPENAI_MODEL
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

---

## Architecture Overview

### Backend (FastAPI + SQLite)

```
backend/app/
├── api/
│   ├── deps.py           # Dependency injection (auth, DB, services)
│   └── routes/
│       ├── auth.py       # POST /api/auth/register|login|refresh|logout, GET /me
│       ├── documents.py  # Document CRUD, versions, permissions
│       ├── ai.py         # SSE streaming, suggestion decisions, history
│       └── websocket.py  # WS /ws/documents/{id}?token=<jwt>
├── ai/
│   ├── provider.py       # Abstract LLM provider interface
│   ├── openai_provider.py
│   ├── mock_provider.py  # Streams mock responses for dev/demo
│   └── prompts.py        # Configurable prompt templates
├── core/
│   ├── config.py         # Settings from .env
│   ├── database.py       # SQLAlchemy + SQLite setup
│   └── security.py       # bcrypt hashing, JWT creation/validation
├── models/               # SQLAlchemy ORM models
├── schemas/              # Pydantic request/response models
├── services/             # Business logic layer
└── websocket/            # WebSocket protocol + connection manager
```

### Frontend (React + TypeScript + Tiptap)

```
frontend/src/
├── api/
│   ├── client.ts         # Axios with silent token-refresh interceptor
│   └── index.ts          # Typed API functions + getValidToken()
├── store/
│   ├── authStore.ts      # Zustand auth state
│   └── documentStore.ts  # Document/version/permission state
├── hooks/
│   ├── useCollaboration.ts  # WebSocket with reconnect + exponential backoff
│   ├── useAIStream.ts       # SSE fetch reader with cancel support
│   └── useAutoSave.ts       # Debounced content save
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   └── EditorPage.tsx       # Main editor (Tiptap + WS + AI panel)
└── components/
    ├── editor/              # Toolbar, PresenceBar, SaveStatus, VersionHistory, ShareModal
    └── ai/                  # AIPanel (streaming), AIHistoryModal
```

---

## WebSocket Protocol

The backend uses a token-in-query-param pattern for WebSocket auth:

```
ws://localhost:8000/ws/documents/{document_id}?token=<access_token>
```

**Client → Server messages:**
```json
{ "type": "join_session" }
{ "type": "edit_event", "content": "<html content>" }
{ "type": "ping" }
```

**Server → Client messages:**
```json
{ "type": "session_joined", "document_id": 1, "role": "owner", "content": "...", "active_users": [...] }
{ "type": "document_update", "document_id": 1, "content": "...", "updated_by_user_id": 2 }
{ "type": "presence_update", "active_users": [{"user_id": 1, "username": "alice"}] }
{ "type": "pong" }
{ "type": "error", "detail": "..." }
```

---

## AI Streaming

AI requests stream token-by-token via SSE (`text/event-stream`):

```
POST /api/ai/stream
Authorization: Bearer <token>
{ "document_id": 1, "action": "summarize", "selected_text": "...", "options": {} }
```

Supported actions: `rewrite`, `summarize`, `translate`, `enhance`

Stream format:
```
data: Hello \n\n
data:  world\n\n
event: done\ndata: {"interaction_id": 1, "suggestion_id": 1}\n\n
```

---

## Demo Script (for presentation)

1. Open two browser windows side by side at `http://localhost:5173`
2. Register two accounts (e.g. `alice@test.com` / `bob@test.com`)
3. As Alice: create a document → observe auto-save status
4. Share with Bob as **Editor** via Share modal
5. As Bob: open same document → see Alice's avatar in presence bar
6. Type in Window 1 → changes appear in Window 2 in real time
7. Change Bob to **Viewer** → try editing as Bob → observe 403 error
8. Select text → open AI panel → choose **Summarize** → watch token streaming
9. Click **Cancel** mid-stream → generation stops immediately
10. Edit suggestion → click **Accept & Apply** → text inserted → click **Undo**
11. Try **Translate** (second AI feature)
12. Open **Version History** → restore a previous version
13. Open **AI History** → see full interaction log with accept/reject status

---

## Architecture Deviations

See [DEVIATIONS.md](./DEVIATIONS.md) for a full comparison with the Assignment 1 design.

---

## Team Contributions

| Member | Contribution |
|--------|-------------|
| Beibarys | Backend auth, document service, FastAPI setup |
| Kutbol | WebSocket collaboration layer, connection manager |
| Alghala | Frontend base structure |
| Moza | AI streaming service, LLM provider abstraction, prompt templates, AI panel UI |
