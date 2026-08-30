# RelayPlan test plan

## Automated checks

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The Node test suite currently verifies:

- dependency/capability-aware Ready calculation;
- packet completeness and agent capacity;
- valid and duplicate/ineligible claims;
- progress, time, blocker, and missing-context behavior;
- deliverable submission cannot bypass Human Review;
- human approval completes work and unlocks dependencies;
- clarification answers resume blocked work;
- deterministic reset and workspace version behavior;
- runtime rejection of unknown fields and invalid numeric bounds;
- normalization of valid deliverable input;
- all six registered tool names, a single registration call site, closed schemas, read-only annotations, and absence of human-only agent tools.

## Browser workflow

1. Load the production workspace and note its version.
2. Reset the demonstration through the visible interface and confirm the warning.
3. On desktop, verify Command Center, Task Board, Human Inbox, Agent Roster, Activity History, task packet dialog, export, and status dock.
4. At a narrow viewport, verify navigation, cards, inbox controls, and dialog remain usable without horizontal page overflow.
5. Use keyboard-only navigation and verify visible focus, close behavior, labels, non-color status text, and reduced-motion CSS.
6. Use WebMCP to read the workspace and confirm the version is unchanged.
7. List Ready tasks for Research Agent, claim `RP-104`, and confirm the board and activity update.
8. Post progress; refresh; confirm the note persists.
9. Submit a deliverable; confirm Human Review and Human Inbox.
10. Approve in the visible UI; confirm Completed, dependent `RP-106` becomes Ready, and the full handoff is in Activity History.
11. Verify no console errors and no failed network responses.

## Security checks

- Send an undeclared property and expect HTTP 400.
- Attempt to claim a non-Ready task and expect HTTP 409.
- Attempt to update or submit as the wrong agent and expect HTTP 409.
- Confirm no approval tool is discoverable.
- Confirm text content renders without HTML execution.
- Confirm the public source contains no tokens, credentials, personal names, or private URLs.
