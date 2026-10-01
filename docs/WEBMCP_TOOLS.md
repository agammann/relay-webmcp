# Page-side WebMCP contract

Tools register when the saved workspace has loaded. The browser must expose `document.modelContext` or `navigator.modelContext`. All six have closed JSON schemas and mark returned user content as untrusted. The UI remains available in ordinary browsers.

Each tool has a title for discovery. Registrations use an `AbortSignal`, withdraw on `pagehide` and unmount, and return on a persisted `pageshow`. Registration callbacks from a hidden or replaced document cannot report a connected state. Native testing uses the actual browser API; see [Verification](TEST_PLAN.md).

| Tool | Required input | Optional input |
| --- | --- | --- |
| get_workspace_context | `{}` | None |
| list_ready_tasks | `{}` | `agentId`, `capabilities` (up to 12 strings) |
| claim_task | `agentId`, `taskId` | None |
| update_task_progress | `agentId`, `taskId`, `note`, `completionPercentage` (0–99), `timeSpentMinutes` | `blocker`, `missingInformation` |
| request_human_input | `agentId`, `taskId`, `question`, `reason`, `canContinue` (boolean), `recommendedChoices` (array) | None |
| submit_deliverable | `agentId`, `taskId`, `summary`, `content`, `evidence` (array), `knownLimitations` (array), `recommendedNextAction` | None |

Types are checked at runtime; strings, numbers and booleans are not coerced. Unknown properties and unknown profiles are rejected. An optional capability filter narrows a profile's eligible work; it cannot expand the profile's capabilities.

`get_workspace_context` returns `name`, `goal`, `deadline`, progress counts, `agents`, full `tasks`, full `clarifications`, `readyTasks`, recent activity, project ID, version, and update time. Task results include progress history, deliverables and review feedback. Answered questions remain readable so work can resume.

Writes return a saved action result with task ID, agent ID, previous/current state, changed IDs, summary, warnings, project ID, version, update time, current task, and its clarifications. Database or validation failures reject the tool call. No local substitute state is created.

Example sequence after creating a planning task:

```json
{"agentId":"planning-agent"}
```

Call `list_ready_tasks` with that input, choose an actual returned task ID, then call `claim_task`. Use `update_task_progress` to report progress or a current blocker. Omitting blocker fields on a later progress update clears the previous progress blocker, but cannot clear unanswered blocking questions. Use `request_human_input` when an answer is needed; `canContinue: false` blocks submission until the question is answered.

`submit_deliverable` moves the assigned task to `human_review`. Review, clarification answers, task creation/editing, profile creation, reset, and backup import are UI actions and are not included in the six tool registrations. The same-session UI API supports those actions: this is a workflow distinction, not an authenticated human-role boundary.

Before a write starts, an aborted tool call is refused. After submission, Relay waits for the server response; aborting a caller cannot undo a database commit. On an unconfirmed response, refresh and inspect the workspace before attempting the action again.
