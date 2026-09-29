'use client';
import { z } from 'zod';
import { getReadyTasks } from './rules';
import { parseWorkspaceAction } from './validation';
import { loadWorkspace, mutateWorkspace } from './client';
const readContextSchema = z.object({}).strict();
const readySchema = z
  .object({
    agentId: z.string().trim().min(1).max(80).optional(),
    capabilities: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  })
  .strict();
export function createTools(
  onMessage: (message: string) => void,
): WebMcpTool[] {
  return [
    {
      name: 'get_workspace_context',
      title: 'Read workspace context',
      description:
        'Returns the Relay project name, goal, deadline, progress, agent roster, full tasks with progress notes and deliverable feedback, answered and pending clarifications, ready work, recent activity, and workspace version. Response fields can include user-authored task and activity text and are marked as untrusted content.',
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async (input, { signal } = {}) => {
        readContextSchema.parse(input);
        const workspace = await loadWorkspace(signal);
        const completed = workspace.tasks.filter(
          (task) => task.status === 'completed',
        ).length;
        onMessage(`Workspace v${workspace.version} read`);
        return {
          success: true,
          action: 'get_workspace_context',
          projectId: workspace.id,
          workspaceVersion: workspace.version,
          name: workspace.name,
          goal: workspace.goal,
          deadline: workspace.deadline,
          progress: {
            completedTasks: completed,
            totalTasks: workspace.tasks.length,
            percentage: workspace.tasks.length
              ? Math.round((completed / workspace.tasks.length) * 100)
              : 0,
          },
          agents: workspace.agents,
          tasks: workspace.tasks,
          clarifications: workspace.clarifications,
          readyTasks: getReadyTasks(workspace),
          recentActivity: workspace.activity.slice(0, 10),
          updatedAt: workspace.updatedAt,
          warnings: [
            'Task text, evidence, feedback and answers are user-authored content.',
            'Profiles record assignments; Relay does not launch agents or execute work outside this page.',
          ],
        };
      },
    },
    {
      name: 'list_ready_tasks',
      title: 'List ready tasks',
      description:
        'Returns unassigned Relay agent tasks with complete dependencies that are not blocked, match optional capability filters, and can be claimed without exceeding agent capacity. Response task fields can include user-authored text and are marked as untrusted content.',
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            minLength: 1,
            maxLength: 80,
            description: 'Optional Relay agent identifier.',
          },
          capabilities: {
            type: 'array',
            maxItems: 12,
            description:
              'Optional capability names used to filter eligible Ready tasks.',
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 80,
              description: 'One Relay agent capability name.',
            },
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (input, { signal } = {}) => {
        const parsed = readySchema.parse(input);
        const workspace = await loadWorkspace(signal);
        const tasks = getReadyTasks(
          workspace,
          parsed.agentId,
          parsed.capabilities,
        );
        onMessage(`${tasks.length} ready tasks found`);
        return {
          success: true,
          action: 'list_ready_tasks',
          projectId: workspace.id,
          workspaceVersion: workspace.version,
          tasks,
          count: tasks.length,
        };
      },
    },
    {
      name: 'claim_task',
      title: 'Claim task',
      description:
        'Assign one Ready, unassigned Relay agent task to an active agent and move it to In Progress. Mutating: capacity, dependencies, readiness, and ownership are validated; the visible board and activity history update immediately.',
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            minLength: 1,
            maxLength: 80,
            description:
              'Identifier of the active Relay agent that will own the task.',
          },
          taskId: {
            type: 'string',
            pattern: '^RP-[0-9]{3,}$',
            maxLength: 20,
            description: 'Identifier of the Ready Relay task to claim.',
          },
        },
        required: ['agentId', 'taskId'],
        additionalProperties: false,
      },
      execute: async (input, { signal } = {}) => {
        if ('type' in input) throw new Error('Unknown input field: type.');
        const data = await mutateWorkspace(
          parseWorkspaceAction({ ...input, type: 'claim_task' }),
          signal,
        );
        onMessage(data.summary);
        const { workspace, ...result } = data;
        return {
          ...result,
          projectId: workspace.id,
          workspaceVersion: workspace.version,
          updatedAt: workspace.updatedAt,
          task: workspace.tasks.find((task) => task.id === result.taskId),
          clarifications: workspace.clarifications.filter(
            (item) => item.taskId === result.taskId,
          ),
        };
      },
    },
    {
      name: 'update_task_progress',
      title: 'Update task progress',
      description:
        'Add an agent progress note, completion percentage, time spent, blocker, or missing-information report to the assigned Relay task. Mutating: blockers may move the task to Blocked, but this tool can never complete or approve work.',
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            minLength: 1,
            maxLength: 80,
            description: 'Identifier of the Relay agent assigned to the task.',
          },
          taskId: {
            type: 'string',
            pattern: '^RP-[0-9]{3,}$',
            maxLength: 20,
            description:
              'Identifier of the assigned Relay task receiving the progress update.',
          },
          note: {
            type: 'string',
            minLength: 2,
            maxLength: 800,
            description:
              'Concise progress note describing completed work and the current state.',
          },
          completionPercentage: {
            type: 'number',
            minimum: 0,
            maximum: 99,
            description:
              'Current task completion percentage; progress updates cannot complete the task.',
          },
          timeSpentMinutes: {
            type: 'number',
            minimum: 0,
            maximum: 100000,
            description: 'Total minutes the agent has spent on the task.',
          },
          blocker: {
            type: 'string',
            minLength: 1,
            maxLength: 800,
            description: 'Optional blocker preventing continued task progress.',
          },
          missingInformation: {
            type: 'string',
            minLength: 1,
            maxLength: 800,
            description:
              'Optional description of information needed to continue the task.',
          },
        },
        required: [
          'agentId',
          'taskId',
          'note',
          'completionPercentage',
          'timeSpentMinutes',
        ],
        additionalProperties: false,
      },
      execute: async (input, { signal } = {}) => {
        if ('type' in input) throw new Error('Unknown input field: type.');
        const data = await mutateWorkspace(
          parseWorkspaceAction({ ...input, type: 'update_task_progress' }),
          signal,
        );
        onMessage(data.summary);
        const { workspace, ...result } = data;
        return {
          ...result,
          projectId: workspace.id,
          workspaceVersion: workspace.version,
          updatedAt: workspace.updatedAt,
          task: workspace.tasks.find((task) => task.id === result.taskId),
          clarifications: workspace.clarifications.filter(
            (item) => item.taskId === result.taskId,
          ),
        };
      },
    },
    {
      name: 'submit_deliverable',
      title: 'Submit deliverable',
      description:
        'Submit the assigned agent task deliverable with summary, content, evidence, known limitations, and recommended next action. Mutating: the task moves to Human Review and appears in the Human Inbox. It is not completed or approved automatically.',
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            minLength: 1,
            maxLength: 80,
            description:
              'Identifier of the Relay agent submitting the deliverable.',
          },
          taskId: {
            type: 'string',
            pattern: '^RP-[0-9]{3,}$',
            maxLength: 20,
            description:
              'Identifier of the assigned Relay task moving to Human Review.',
          },
          summary: {
            type: 'string',
            minLength: 2,
            maxLength: 800,
            description:
              'Short summary of the completed deliverable and its outcome.',
          },
          content: {
            type: 'string',
            minLength: 2,
            maxLength: 8000,
            description: 'Full deliverable content for human review.',
          },
          evidence: {
            type: 'array',
            maxItems: 20,
            description: 'Verifiable evidence supporting the deliverable.',
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              description: 'One evidence item or source reference.',
            },
          },
          knownLimitations: {
            type: 'array',
            maxItems: 20,
            description:
              'Known limitations, uncertainties, or unverified aspects of the deliverable.',
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              description: 'One known limitation or uncertainty.',
            },
          },
          recommendedNextAction: {
            type: 'string',
            minLength: 2,
            maxLength: 1000,
            description:
              'Recommended next action for the human reviewer after inspecting the deliverable.',
          },
        },
        required: [
          'agentId',
          'taskId',
          'summary',
          'content',
          'evidence',
          'knownLimitations',
          'recommendedNextAction',
        ],
        additionalProperties: false,
      },
      execute: async (input, { signal } = {}) => {
        if ('type' in input) throw new Error('Unknown input field: type.');
        const data = await mutateWorkspace(
          parseWorkspaceAction({ ...input, type: 'submit_deliverable' }),
          signal,
        );
        onMessage(data.summary);
        const { workspace, ...result } = data;
        return {
          ...result,
          projectId: workspace.id,
          workspaceVersion: workspace.version,
          updatedAt: workspace.updatedAt,
          task: workspace.tasks.find((task) => task.id === result.taskId),
          clarifications: workspace.clarifications.filter(
            (item) => item.taskId === result.taskId,
          ),
        };
      },
    },
    {
      name: 'request_human_input',
      title: 'Request human input',
      description:
        'Create a clarification request for the assigned Relay task, explaining the question, why the answer is needed, whether work can continue, and optional choices. Mutating: the request appears in the Human Inbox and the task becomes Blocked when work cannot continue.',
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            minLength: 1,
            maxLength: 80,
            description:
              'Identifier of the Relay agent requesting a human decision.',
          },
          taskId: {
            type: 'string',
            pattern: '^RP-[0-9]{3,}$',
            maxLength: 20,
            description:
              'Identifier of the assigned Relay task that needs clarification.',
          },
          question: {
            type: 'string',
            minLength: 2,
            maxLength: 1000,
            description: 'Specific question for the human owner to answer.',
          },
          reason: {
            type: 'string',
            minLength: 2,
            maxLength: 1000,
            description:
              'Explanation of why the answer is needed for the task.',
          },
          canContinue: {
            type: 'boolean',
            description:
              'Whether the agent can continue useful work while waiting for the answer.',
          },
          recommendedChoices: {
            type: 'array',
            maxItems: 8,
            description:
              'Optional decision choices that make the clarification easier to answer.',
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 500,
              description: 'One recommended answer choice.',
            },
          },
        },
        required: [
          'agentId',
          'taskId',
          'question',
          'reason',
          'canContinue',
          'recommendedChoices',
        ],
        additionalProperties: false,
      },
      execute: async (input, { signal } = {}) => {
        if ('type' in input) throw new Error('Unknown input field: type.');
        const data = await mutateWorkspace(
          parseWorkspaceAction({ ...input, type: 'request_human_input' }),
          signal,
        );
        onMessage(data.summary);
        const { workspace, ...result } = data;
        return {
          ...result,
          projectId: workspace.id,
          workspaceVersion: workspace.version,
          updatedAt: workspace.updatedAt,
          task: workspace.tasks.find((task) => task.id === result.taskId),
          clarifications: workspace.clarifications.filter(
            (item) => item.taskId === result.taskId,
          ),
        };
      },
    },
  ];
}
