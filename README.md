# Collaborative Document Editor Monorepo PoC

This proof of concept demonstrates a minimal frontend-to-backend flow for a collaborative document editor assignment. It validates frontend-backend communication and validates that the data contracts in the architecture are explicit and implemented consistently across the stack.

## What This PoC Demonstrates

- Monorepo structure with `frontend/`, `backend/`, `shared/`, `docs/`, and `tests/`
- React + Vite + TypeScript frontend
- Python FastAPI backend
- Explicit DTO contracts shared through documentation and mirrored in code
- Working document creation, loading, and saving flow
- In-memory backend storage for fast local setup

## Intentionally Not Implemented Yet

- Authentication and authorization
- AI assistance
- Real-time sync or collaborative editing
- Database persistence
- Version history

These features are intentionally out of scope for this PoC.

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

3. Run the FastAPI server with uvicorn:

```bash
uvicorn src.main:app --reload --port 8000
```

Backend endpoints:

- `GET /health`
- `POST /api/documents`
- `GET /api/documents/{id}`
- `PUT /api/documents/{id}`

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

This PoC validates:

- frontend-backend communication
- data contracts from the architecture

Auth, AI, version history, and real-time sync are intentionally out of scope for this PoC.
