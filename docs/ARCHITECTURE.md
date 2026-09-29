# Architecture

Relay uses React 19, vinext, a Cloudflare Worker, and D1. The browser renders the project and registers six page-side WebMCP tools. Both UI controls and tools use the same client store and `/api/workspace` endpoint.

## Persistence

GET creates or reads a browser-bound workspace. A random 256-bit HttpOnly, SameSite=Strict cookie is hashed to obtain the D1 row key; the exposed workspace ID is not the cookie credential. HTTPS sets Secure. No credentials are embedded in links or exports.

The previous global example row is left in place and never selected by this code. New visitors start with an empty project and four profiles. An example project is an explicit replacement action.

POST accepts `{expectedVersion, action}`. The server validates the action, selects the cookie's workspace, applies pure domain rules, then updates the row only if its stored version still matches. A race returns a conflict. Versions increase through reset and import as well as ordinary edits. There is no automatic write retry or optimistic UI mutation.

The runtime creates the table idempotently; the checked-in SQL migration is also idempotent. Data and indexes from prior releases remain compatible. Local Wrangler storage is separate from production.

## Client state and errors

The client store uses `useSyncExternalStore`. The UI and tools receive the same confirmed workspace, and selected tasks are resolved by ID on each render. Reads coalesce and do not replace newer state with older versions. Local simultaneous writes are refused while one save is pending. Other tabs require explicit Refresh and receive stale-version conflicts.

Requests time out after 20 seconds. A lost response may leave a write's outcome unknown, so errors instruct the user to refresh before retrying. Cancellation is checked before a tool starts a write; once submitted, the client waits for the response rather than claiming a server commit was rolled back. There is no offline success fallback.

## Task model

Task packets require context, objective, output, criteria, deadline, and review instructions. Draft tasks may be edited, with references checked for cycles. A profile's capacity includes work in progress, blocked work, and work awaiting review. Blocking questions and the latest progress blocker are evaluated separately. Submission requires unblocked work; only a review approval completes an agent assignment.

Backups contain the complete workspace, within documented size and history limits. Import validates the graph and workflow state, then keeps the destination's identity and increments its version. Replacing a project does not import an access cookie.

## Boundaries

Agent profiles are labels, not logins. Page-tool restrictions define a workflow surface, not authorization against software operating the same browser session. Relay does not execute task instructions, fetch evidence references, call providers, or launch agents. Human and agent content is rendered as text.
