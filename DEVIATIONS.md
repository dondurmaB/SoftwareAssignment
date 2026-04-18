# Architecture Deviations from Assignment 1

This file documents every difference between the Assignment 1 design and the final implementation.
Deviations are not penalised — only undocumented ones are.

---

## DEV-1 — SQLite instead of PostgreSQL

**A1 Design:** A relational database was implied by the ER diagram with UUID primary keys and foreign keys.

**Implementation:** SQLite via SQLAlchemy (`sqlite:///./app.db`). The DATABASE_URL is configurable in `.env`, so swapping to PostgreSQL requires only changing one environment variable — no code changes.

**Why:** The assignment states "a database is not required — in-memory storage or file-based persistence is acceptable." SQLite is simpler to set up for development and demo, while the SQLAlchemy ORM ensures the schema is database-agnostic.

**Classification:** Acceptable compromise. Production upgrade = change `DATABASE_URL` in `.env`.

---

## DEV-2 — WebSocket token passed as query parameter

**A1 Design:** Authenticated WebSocket connections were described at a high level without specifying the mechanism.

**Implementation:** The JWT access token is passed as a query parameter: `ws://host/ws/documents/{id}?token=<jwt>`. The server validates it immediately before accepting the connection.

**Why:** FastAPI's WebSocket upgrade happens before headers are readable in the same way as HTTP requests. Query-param auth is a standard WebSocket pattern. The risk of token leakage in logs is mitigated in production by using HTTPS/WSS.

**Classification:** Improvement over the vague A1 description. Standard practice for WebSocket auth.

---

## DEV-3 — AI features limited to 4 actions (rewrite, summarize, translate, enhance)

**A1 Design:** Proposed rewrite, summarize, translate, enhance, grammar fix, and custom prompt.

**Implementation:** Four actions: `rewrite`, `summarize`, `translate`, `enhance`. Grammar fix and custom prompt were removed to keep the `AIAction` enum clean and the prompt templates focused.

**Why:** The assignment requires "at least 2 AI features." All four implemented features are fully functional with streaming, accept/reject, undo, and history. Quality over quantity.

**Classification:** Intentional scope reduction. Additional actions can be added by extending the `AIAction` enum and adding a prompt template.

---

## DEV-4 — Integer IDs instead of UUIDs

**A1 Design:** The ER diagram used UUID primary keys.

**Implementation:** Auto-increment integer IDs (SQLAlchemy default). This is simpler and performs better for SQLite. UUIDs can be added as a separate `public_id` column if needed.

**Classification:** Acceptable simplification for academic scope.

---

## DEV-5 — Version snapshots saved on every PUT, not just auto-save

**A1 Design:** "A user saves changes or applies AI suggestions → system stores a new version."

**Implementation:** Every `PUT /api/documents/{id}` call with a `content` update creates a new `DocumentVersion` snapshot. The frontend debounces saves at 1.5 seconds, so versions are created at a reasonable cadence — not on every keystroke.

**Why:** Keeping versioning in the service layer (not the client) ensures versions are always created, even if the client crashes mid-session.

**Classification:** Refinement of A1 design. Slightly more versions may be created than expected, but history is complete and rollback always works.

---

## DEV-6 — No CRDT / OT conflict resolution (last-write-wins)

**A1 Design:** FR-RT-3 listed conflict handling as a requirement.

**Implementation:** Last-write-wins at the document level. The most recent `edit_event` WebSocket message overwrites all others. Cursor position is restored as best-effort.

**Why:** Full CRDT (Yjs) is listed as a **bonus** feature in the A2 rubric. The baseline requirement ("basic last-write-wins or simple merge approach is acceptable") is met. CRDT integration would require replacing the WebSocket message handler and Tiptap bindings.

**Classification:** Known limitation, documented as the primary future improvement.

---

## Summary Table

| ID    | Area              | A1 Design           | Implementation           | Type        |
|-------|-------------------|---------------------|--------------------------|-------------|
| DEV-1 | Database          | Relational DB        | SQLite (swappable)       | Compromise  |
| DEV-2 | WS auth           | Unspecified          | Query-param JWT          | Improvement |
| DEV-3 | AI features       | 6 features           | 4 features               | Scope cut   |
| DEV-4 | Primary keys      | UUID                 | Integer IDs              | Simplification |
| DEV-5 | Versioning        | On save/AI accept    | On every content PUT     | Refinement  |
| DEV-6 | Conflict handling | Specified in FR-RT-3 | Last-write-wins          | Known limit |
