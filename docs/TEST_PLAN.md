# Verification

Run from a clean install with Node 24+ and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

Unit tests cover complete-packet readiness, profile capabilities and capacity, duplicate claims, multiple blocking questions, independent progress blockers, revision/resubmission history, approval and dependency unlock, human completion, edit/delete constraints, backup validation, monotonic replacement versions, and browser cookie identity.

Playwright runs the built Worker with its real local D1 emulator. It checks all six page handlers through a registration harness, a complete handoff with human answers and review, custom project/task/profile creation, export and restore, reload persistence, separate browser workspaces, conflicting tab edits, storage failures without fake success, and 390/320px layouts with dialog focus and Escape.

The registration harness is test instrumentation, not evidence of native browser support. Separately check native tool discovery and invocation on the deployed public page. Test data belongs in a fresh browser workspace. Screenshots in `docs/assets` show the checked local release.

CI uses these commands on Linux and retains browser traces on failure. Check the workflow for the exact published source; old successful runs do not validate later changes.
