# Verification

Run from a clean install with Node 24+ and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm audit
pnpm exec playwright install chromium
pnpm exec playwright install chrome
pnpm build
pnpm test:e2e
pnpm test:webmcp
```

Unit tests cover complete-packet readiness, profile capabilities and capacity, duplicate claims, multiple blocking questions, independent progress blockers, revision/resubmission history, approval and dependency unlock, human completion, edit/delete constraints, backup validation, monotonic replacement versions, and browser cookie identity.

Playwright runs the built Worker with its real local D1 emulator. It checks all six page handlers through a registration harness, a complete handoff with human answers and review, custom project/task/profile creation, export and restore, reload persistence, separate browser workspaces, conflicting tab edits, storage failures without fake success, and 390/320px layouts with dialog focus and Escape.

The five native tests use real `document.modelContext` discovery and execution. They check six titled schemas and annotations; a complete durable handoff with human answers, revision, approval and dependency unlock; invalid inputs, ownership and dependency refusals without changed state; failed saves, stale versions and separate browser identities; and withdrawal/restoration through actual back/forward caching. The suite asserts that `registerTool` is native code. It does not install the ordinary suite's registration harness.

The native config enables the experimental `WebMCP` feature and permits back/forward caching. On Windows, the full local suite passed with Chrome 154.0.8037.93 and Edge 154.0.4258.48 on September 30, 2026. To run Edge in PowerShell:

```powershell
$env:RELAY_WEBMCP_CHANNEL = 'msedge'
pnpm test:webmcp
Remove-Item Env:RELAY_WEBMCP_CHANNEL
```

Run Wrangler-backed suites sequentially. Ordinary tests use port 3013; native tests use 3016. Stop a manually started Worker on either port before its suite. Both use local D1, and neither mutates the public database by default.

To check the deployed page in fresh isolated browser sessions:

```powershell
$env:RELAY_WEBMCP_URL = 'https://relay.alx21.chatgpt.site'
pnpm test:webmcp
Remove-Item Env:RELAY_WEBMCP_URL
```

Remote mode runs the two discovery/read and lifecycle tests. It skips the three mutating or fault-injection fixtures. It records whether the deployed host restored a cached page rather than requiring that hosting behavior. Check public saved writes separately through the UI and a supporting browser agent, using a fresh practice workspace; do not replace an existing project. The registration harness alone is not evidence of native support. Screenshots in `docs/assets` show the checked local release.

CI uses these commands on Linux and retains browser traces on failure and `test-results/native-webmcp.json` on every native run. Check the workflow for the exact published source; old successful runs do not validate later changes.

## October 7, 2026 local candidate

Node 24.19.0 and pnpm 11.19.0: frozen install, 17 unit cases, lint, typecheck and build passed. The five ordinary cases passed on Chromium 145.0.7632.6 and all five native cases passed on Chrome 155.0.8059.39. A separate newcomer journey created a custom task, measured an actual local Worker response, submitted it through the UI, requested a revision, resubmitted and approved it, reloaded, exported and restored the task and both deliverables. A separate task invoked all six real native tools and read back the saved D1 result. Desktop 1280×800 and mobile 390×844 had no horizontal overflow or browser errors. These are local candidate results; they do not establish deployment or a separately connected assistant host.

The full audit remains unsuccessful with one unpatched high-severity braces finding. The candidate and checks are not a released 1.1.1 artifact. Historical successful CI and production checks remain dated evidence for their exact earlier source.
