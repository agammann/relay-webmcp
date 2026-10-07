# Relay security

## Scope and boundaries

The current default branch is maintained. Report suspected vulnerabilities privately through this repository's GitHub Security reporting feature when available; otherwise contact the repository maintainer without posting sensitive details publicly. Include the version, affected behavior, and a minimal safe reproduction.

Each browser gets a separate server-stored workspace selected by an HttpOnly cookie. HTTPS uses Secure and SameSite=Strict. A hash of the random cookie is the workspace ID; exports do not contain the cookie. There is no account recovery, team access model, or end-to-end encryption. Use backups and avoid storing secrets or sensitive production data.

Mutations require JSON and the current workspace version. Runtime validation, dependency rules, and compare-and-swap writes prevent invalid transitions and accidental stale overwrites. The API rejects cross-origin mutations and sends no-store responses. Text is rendered without raw HTML execution; references are not fetched.

The six WebMCP tools omit approval and project replacement. That is a workflow constraint, not authentication of a human role. Agent profiles are labels. Anyone or any software controlling the same browser session can use its interface and API. Relay does not authenticate separate agents or provide a multi-user authorization system.

A failed or interrupted save is not reported as locally successful. The response can be lost after a commit, so refresh and check the current state before retrying. There is no offline write queue.

The response policy retains same-origin resource restrictions, HSTS and the other security headers. It omits `upgrade-insecure-requests` because that directive upgrades local HTTP loopback images to unsupported HTTPS; the favicon redirect remains relative to the current origin. Hosted deployment still requires HTTPS.

## Dependency checks

Run `pnpm security:audit` when changing dependencies. CI retains the full dependency reports in its artifacts.
