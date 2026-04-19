# Architecture Deviations from Assignment 1

This file documents differences between the Assignment 1 design/report and the final implementation.

Deviations are acceptable if they are clearly documented. In several places, the final system intentionally favors a stable, demonstrable baseline over a more ambitious production-style design.

---

## DEV-1 — SQLite instead of PostgreSQL

**A1 Design:** A relational database was implied by the ER diagram and data model, with UUID-style identifiers and foreign-key relationships.

**Implementation:** The project uses SQLite via SQLAlchemy (`sqlite:///./app.db`). The database URL is configurable through `.env`, so switching to PostgreSQL would primarily require changing `DATABASE_URL`, not rewriting the application logic.

**Why:** The assignment allows lightweight persistence, and SQLite is much simpler to set up for development, testing, and demo use. SQLAlchemy keeps the data-access layer largely database-agnostic.

**Classification:** Acceptable compromise.

---

## DEV-2 — Integer IDs instead of UUIDs

**A1 Design:** The ER diagram used UUID primary keys.

**Implementation:** The final system uses auto-increment integer primary keys.

**Why:** Integer IDs are simpler for SQLite-based development and easier to inspect/debug during implementation. UUIDs could be added later as separate public identifiers if needed.

**Classification:** Acceptable simplification.

---

## DEV-3 — WebSocket token passed as query parameter

**A1 Design:** Authenticated WebSocket collaboration was described at a high level, but the exact token-passing mechanism was not fixed.

**Implementation:** The JWT access token is passed as a query parameter:
`ws://host/ws/documents/{id}?token=<jwt>`

The server validates the token before accepting the connection.

**Why:** This is a practical and common approach for authenticated WebSocket connections in FastAPI-style applications, especially when aligning WebSocket auth with an existing JWT-based HTTP auth flow.

**Classification:** Implementation refinement.

---

## DEV-4 — AI features reduced from 6 proposed actions to 4 implemented actions

**A1 Design:** The design discussed a wider AI assistant scope, including:
- rewrite
- summarize
- translate
- enhance
- grammar fix
- custom prompt

**Implementation:** The final system implements 4 AI actions:
- `rewrite`
- `summarize`
- `translate`
- `enhance`

Grammar-fix and free-form custom prompt actions were not included in the final shipped enum/UI.

**Why:** The assignment requires at least 2 AI features. The implemented 4 features are fully wired with streaming generation, accept/reject decisions, undo/apply flow, and history support. The narrower action set was chosen to keep the implementation stable and coherent.

**Classification:** Intentional scope reduction.

---

## DEV-5 — AI generation uses SSE streaming instead of a more request-lifecycle-oriented design

**A1 Design:** AI functionality was described more generally as backend-assisted AI operations with traceable lifecycle/history semantics, and earlier design thinking was closer to an asynchronous request model.

**Implementation:** The final system uses `text/event-stream` (SSE) to stream AI output progressively to the frontend. The frontend displays chunks live while the backend persists interaction history and suggestion decision state.

**Why:** SSE gave a simpler and better real-time UX for selected-text AI assistance, and was easier to integrate for the assignment than a more elaborate queued/polled async request lifecycle.

**Classification:** Implementation refinement / architectural deviation.

---

## DEV-6 — AI provider support is broader in one way and narrower in another

**A1 Design:** The design assumed external AI-provider-backed functionality, but did not lock the final provider mechanism in detail.

**Implementation:** The final backend supports:
- `mock`
- `openai`
- `lmstudio`

`lmstudio` support was added through an OpenAI-compatible local endpoint. At the same time, the implemented feature/action scope was reduced to 4 actions rather than the larger AI surface discussed in the design.

**Why:** Local-provider support made demo/testing easier and reduced dependence on external billing or API access. The provider architecture stayed modular while the action set stayed intentionally focused.

**Classification:** Practical implementation refinement.

---

## DEV-7 — AI cancel is frontend-abort based, not a fully orchestrated server-side cancel workflow

**A1 Design:** AI request lifecycle control was implied conceptually, especially for long-running streamed generation.

**Implementation:** The frontend provides a cancel action for in-progress AI generation by aborting the active request/stream from the client side. The final system does not implement a more advanced distributed cancellation mechanism with strong server-side orchestration guarantees across all possible intermediate states.

**Why:** A safe frontend abort flow was enough for the assignment/demo and much lower risk than expanding the AI execution lifecycle further near deadline.

**Classification:** Acceptable compromise / partial implementation.

---

## DEV-8 — Versioning uses explicit meaningful checkpoints, not every content update

**A1 Design:** Versioning was intended to capture meaningful document history when users save changes or apply AI suggestions. The design also emphasized that version history should represent stable checkpoints rather than every individual edit.

**Implementation:** The backend now creates `DocumentVersion` entries only on explicit meaningful events:
- document creation
- manual **Save version**
- AI apply/accept
- restore

Autosave and live WebSocket collaboration updates still change `document.current_content`, but they do **not** create a new version entry on every edit.

**Why:** This keeps history meaningful and avoids version spam from autosave and collaboration traffic while still preserving an audit trail for important content milestones.

**Classification:** Refinement of the original design intent.

---

## DEV-9 — Restore creates a new version entry with provenance metadata

**A1 Design:** Restore/revert behavior was intended to preserve audit history rather than overwrite it destructively.

**Implementation:** Restoring a version appends a new latest version entry and records which earlier version it came from via restore metadata (`restored_from_version_number`). The UI displays a simple label such as `Restored from version X`.

**Why:** This preserves a clear audit trail and makes restore history explicit to users.

**Classification:** Clarification/refinement of the design intent.

---

## DEV-10 — Conflict handling is baseline last-write-wins, not CRDT/OT

**A1 Design:** The design discussed conflict handling as part of real-time collaboration and envisioned stronger merge/resolution behavior for concurrent edits.

**Implementation:** The shipped system uses a baseline real-time synchronization model over WebSockets. Concurrent edits are effectively handled with document-level last-write-wins behavior rather than CRDT/OT.

**Why:** Full CRDT/OT collaboration was beyond the safe scope of the assignment timeline. The assignment baseline allows a simpler collaboration model, and this approach delivered a working real-time proof of concept.

**Classification:** Known limitation / intentional simplification.

---

## DEV-11 — Presence awareness is limited to active users only

**A1 Design:** The design/report discussed richer collaborator awareness, including cursor/editing-location style presence.

**Implementation:** The final system supports basic session presence (active collaborators), but does **not** implement:
- remote cursors
- live selection highlights
- typing indicators

**Why:** Rich presence features are significantly more complex in a shared rich-text editor and were deprioritized in favor of stable baseline collaboration.

**Classification:** Intentional scope reduction.

---

## DEV-12 — Reconnect/offline merge behavior is baseline only

**A1 Design:** The design anticipated reconnect-aware synchronization and attempted merge/recovery of unsent local edits after temporary disconnection, with manual resolution where safe merge was not possible.

**Implementation:** The final system supports basic WebSocket reconnection and continued live collaboration when the connection is available, but it does **not** implement:
- robust offline edit queueing
- replay of unsent local operations
- conflict-safe merge of offline drafts after reconnect

A more ambitious reconnect-protection layer was attempted during development, but it introduced editor instability and was rolled back in favor of the simpler stable baseline.

**Why:** Stable typing/editor behavior was prioritized over late-stage experimental reconnect logic.

**Classification:** Known limitation / deferred future work.

---

## DEV-13 — No document export/download feature

**A1 Design:** The broader document workflow discussion included richer document operations and implied the possibility of export-style outputs.

**Implementation:** The final system does not provide document export/download endpoints or frontend export UI.

**Why:** Development effort was prioritized toward the required baseline: auth, sharing, AI-assisted editing, version history, and real-time collaboration.

**Classification:** Intentional scope reduction.

---

## Summary Table

| ID     | Area                     | A1 Design / Expectation                         | Final Implementation                              | Type |
|--------|--------------------------|--------------------------------------------------|---------------------------------------------------|------|
| DEV-1  | Database                 | Relational DB implied                            | SQLite via SQLAlchemy                             | Compromise |
| DEV-2  | Primary keys             | UUIDs                                            | Integer IDs                                       | Simplification |
| DEV-3  | WebSocket auth           | High-level authenticated WS                      | JWT in query parameter                            | Refinement |
| DEV-4  | AI actions               | Wider AI assistant scope                         | 4 implemented actions                             | Scope reduction |
| DEV-5  | AI delivery model        | More general/async AI lifecycle thinking         | SSE streaming                                     | Refinement |
| DEV-6  | AI provider setup        | External-provider-oriented                       | mock / openai / lmstudio                          | Refinement |
| DEV-7  | AI cancel                | Richer lifecycle control implied                 | Frontend-abort-based cancel                       | Partial implementation |
| DEV-8  | Versioning               | Meaningful version history                       | Explicit checkpoint versions only                 | Refinement |
| DEV-9  | Restore behavior         | Preserve audit trail                             | Restore appends new version with provenance       | Refinement |
| DEV-10 | Conflict handling        | Stronger concurrent-edit handling                | Baseline last-write-wins                          | Known limitation |
| DEV-11 | Presence awareness       | Rich collaborator awareness                      | Active users only                                 | Scope reduction |
| DEV-12 | Reconnect/offline sync   | Attempt merge/recovery of unsent edits           | Baseline reconnect only                           | Known limitation |
| DEV-13 | Export/download          | Richer document workflow                         | Not implemented                                   | Scope reduction |
