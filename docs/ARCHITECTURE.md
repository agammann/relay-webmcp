# Relay architecture

## System shape

Relay is one React/Vinext application with four deliberately shared layers:

1. **Visible human interface** — command center, six-column task board, Human Inbox, agent roster, activity history, packet dialog, export, and reset.
2. **Page-side WebMCP adapter** — feature detection and exactly-once registration for six narrow tools.
3. **Domain rules** — dependency readiness, packet completeness, capacity, ownership, progress, review gates, clarification, unlocking, versioning, and audit events.
4. **Durable workspace service** — a D1-backed versioned workspace aggregate exposed through `/api/workspace`.

Both the visible interface and WebMCP writes call the same API and the same domain-rule function. A successful write returns the new version and workspace; the client dispatches `relayplan:mutated` so every visible surface updates immediately.

## Persistence and concurrency

The `workspaces` table contains an ID, monotonically increasing version, serialized JSON workspace, and timestamps. A mutation reads version *n*, applies a pure domain transition, then updates with `WHERE version = n`. If another write wins first, Relay retries once and otherwise returns a clear conflict instead of overwriting unseen work.

The API creates and seeds the table idempotently. The same schema is checked in as a Drizzle migration.

## Trust and authority

Agent profiles are coordination labels, not identities. Relay checks the supplied agent ID against task assignment and capacity, but does not claim cryptographic authentication.

The agent tool boundary cannot approve, reject, answer a clarification, delete data, change the project goal, or finalize the project. Approval-required work reaches `human_review`; only a visible human action can move it to `completed`.

## Failure behavior

- Unknown or extra input fields are rejected.
- A rules violation returns a conflict and makes no state change.
- The UI remains usable when WebMCP is absent.
- The static local preview falls back to deterministic in-memory demo state when D1 is unavailable; the production deployment uses D1.
- No tool reports success until the durable mutation response is received.

