# WebMCP tools

Relay registers tools in the top-level page through `document.modelContext.registerTool`. It does not use an iframe or declarative HTML tools. All object schemas set `additionalProperties: false`; read tools use `readOnlyHint`; externally supplied task text is marked untrusted where applicable.

## `get_workspace_context`

Read-only. Returns the project goal, deadline, progress, roster, human and agent tasks, Ready and blocked tasks, pending approvals, recent activity, and workspace version.

Judge prompt: **“Read this Relay project and give me a brief summary. Do not modify anything.”**

## `list_ready_tasks`

Read-only. Optional inputs are `agentId` and `capabilities`. It returns only unassigned agent work whose dependencies are complete, packet is usable, task is not blocked, agent capability matches when requested, and capacity permits a claim.

Judge prompt: **“Show me the Ready tasks that the Research Agent can claim.”**

## `claim_task`

Inputs: `agentId`, `taskId`. Verifies an active agent, a Ready and unassigned agent task, completed dependencies, compatible capacity, and a complete packet. On success it assigns the task, moves it to In Progress, records an activity event, and returns the packet and structured transition result.

## `update_task_progress`

Inputs: agent/task IDs, progress note, completion percentage, time spent, and optional blocker or missing information. Only the assigned agent may write. A blocker can move work to Blocked. The tool cannot mark approval-required work complete.

## `submit_deliverable`

Inputs: agent/task IDs, summary, content, evidence, known limitations, and recommended next action. Only the assigned agent may submit. The task moves to Human Review and appears in the Human Inbox; it does not become Completed.

## `request_human_input`

Inputs: agent/task IDs, question, reason, whether work can continue, and optional recommended choices. It creates a Human Inbox clarification and blocks the task when work cannot continue.

## Result contract

Writes return `success`, `action`, `projectId`, `taskId`, `agentId`, `workspaceVersion`, previous and current statuses, changed entity IDs, warnings, summary, timestamp, and the updated visible workspace. Reads return structured workspace/task data plus the current version.

## Human-only operations

Approval, rejection/revision, clarification answers, reset, export, project-goal changes, deletion, and overall project completion are intentionally not registered as WebMCP tools.

## Manual discovery check

1. Open the production URL in a WebMCP-capable ChatGPT in-app browser or Chrome environment.
2. Open the page’s agent activity dock; it should report six tools registered.
3. Ask the read-only summary prompt and verify no workspace version change.
4. Ask for Ready tasks, claim one, and verify the same task moves visibly to In Progress.
5. Submit a deliverable and verify it stops at Human Review.
6. Approve it in the visible Human Inbox and verify the activity event and dependency unlock.

