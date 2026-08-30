# RelayPlan demo video

## Video metadata

**Title:** RelayPlan — One plan for you and your agents | OpenAI WebMCP Challenge

**Target runtime:** 2:30–2:40; hard maximum 2:45.

**YouTube description:**

RelayPlan gives people and their AI agents one shared project plan. Through six page-side WebMCP tools, agents can read the workspace, discover Ready work, claim tasks, report progress, request clarification, and submit evidence-backed deliverables. Humans retain approval and final-completion authority. Built for the OpenAI WebMCP Challenge.

## Exact recording script

| Time | Screen action / exact prompt | Expected WebMCP call | Exact narration |
| --- | --- | --- | --- |
| 0:00–0:18 | Open RelayPlan Command Center. Show the demonstration-data label, summary cards, board, and Human Inbox count. | None | “People now delegate research, coding, and review to multiple agents, but ordinary planners do not tell an agent what is ready, what context it needs, or what still requires a human decision. RelayPlan gives everyone one shared, auditable plan.” |
| 0:18–0:32 | Pan over Command Center and task cards; briefly open a task packet. | None | “Every agent task carries an objective, inputs, output, definition of done, dependencies, restrictions, deadline, and approval rule. Humans and agents see the same durable workspace.” |
| 0:32–0:47 | Prompt: **“Read this RelayPlan project and give me a brief summary. Do not modify anything.”** | `get_workspace_context` | “RelayPlan registers six top-level WebMCP tools. This first read returns progress, tasks, agents, approvals, activity, and the current workspace version without modifying state.” |
| 0:47–1:00 | Prompt: **“Show me the Ready tasks that the Research Agent can claim.”** | `list_ready_tasks` | “The Ready list is computed from dependencies, assignment, task-packet completeness, capabilities, and agent capacity.” |
| 1:00–1:19 | Prompt: **“Claim the highest-priority Ready task and summarize its task packet.”** Focus `RP-104` moving to In Progress. | `claim_task` | “The agent claims Research WebMCP implementation. The same visible board updates immediately, the structured packet is returned, and an audit event records the transition.” |
| 1:19–1:39 | Prompt: **“Post progress at 80 percent: official tool registration and write-side-effect guidance are verified; 24 minutes spent; no blocker.”** | `update_task_progress` | “Progress, time, blockers, and missing information are durable first-class fields. This tool cannot complete approval-required work.” |
| 1:39–1:59 | Prompt: **“Submit the prepared deliverable with its evidence and known limitations.”** Show task in Human Review and Human Inbox. | `submit_deliverable` | “The agent submits a summary, content, evidence, limitations, and next action. RelayPlan stops the task at Human Review. The agent cannot approve its own work.” |
| 1:59–2:17 | Prompt: **“Show me what is waiting for my approval and what becomes ready if I approve it.”** Then click Human Inbox → Approve. | `get_workspace_context`, then visible human action | “Only the visible human interface can approve or reject. I approve the deliverable, completing the task and automatically unlocking its dependent implementation task.” |
| 2:17–2:33 | Open Task Board, then Activity History. Highlight Completed `RP-104`, Ready `RP-106`, and the sequential events. | None | “The dependency is now Ready, and Activity History preserves who did what, the previous and new status, timestamp, and explanation.” |
| 2:33–2:42 | Return to Command Center and WebMCP status dock. | None | “RelayPlan: one plan for you and your agents. Agents move the work forward; nothing becomes final without your approval.” |

## Prepared deliverable values

- **Summary:** Verified WebMCP registration, annotations, and shared mutation behavior.
- **Content:** RelayPlan feature-detects the top-level Model Context API, registers six closed-schema tools exactly once, and routes agent writes through the same versioned workspace rules and D1 persistence used by the human interface.
- **Evidence:** `https://learn.chatgpt.com/docs/webmcp`, `https://webmachinelearning.github.io/webmcp/`
- **Known limitation:** WebMCP availability depends on the evaluation browser.
- **Recommended next action:** Approve this research deliverable to unlock WebMCP implementation.

## Recording checklist

- Reset the demo immediately before recording.
- Use the verified production URL and a WebMCP-capable browser.
- Hide personal browser chrome, accounts, notifications, tokens, and unrelated tabs.
- Record 1080p or higher with clear zoom and pointer visibility.
- Capture desktop audio and spoken narration; verify an audible audio stream afterward.
- Keep the final edit below 2:45 and the uploaded YouTube visibility Public.
- Verify the independent watch page: title, runtime, 1080p processing, sound, description links, and no accidental private information.
