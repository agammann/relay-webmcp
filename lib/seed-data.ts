import type { AgentProfile, Task, Workspace } from './domain';

const createdAt = '2026-08-25T19:00:00.000Z';

const agents: AgentProfile[] = [
  {
    id: 'planning-agent',
    name: 'Planning Agent',
    description: 'Turns goals into sequenced work with explicit dependencies and decision points.',
    capabilities: ['planning', 'requirements', 'coordination'],
    preferredTaskTypes: ['planning', 'requirements'],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 3,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Finds authoritative sources and produces evidence-backed briefs.',
    capabilities: ['research', 'webmcp', 'documentation', 'accessibility'],
    preferredTaskTypes: ['research', 'review'],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 4,
  },
  {
    id: 'builder-agent',
    name: 'Builder Agent',
    description: 'Implements product surfaces, integrations, tests, and deployment work.',
    capabilities: ['frontend', 'backend', 'webmcp', 'testing', 'deployment'],
    preferredTaskTypes: ['implementation', 'testing'],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 6,
  },
  {
    id: 'reviewer-agent',
    name: 'Reviewer Agent',
    description: 'Checks quality, accessibility, security boundaries, and release readiness.',
    capabilities: ['review', 'accessibility', 'security', 'testing'],
    preferredTaskTypes: ['review', 'testing'],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 5,
  },
];

const task = (
  id: string,
  title: string,
  status: Task['status'],
  priority: Task['priority'],
  dependencies: string[],
  labels: string[],
  overrides: Partial<Task> = {},
): Task => {
  const objective = overrides.objective ?? `Complete ${title.toLowerCase()} for the WebMCP Challenge entry.`;
  const expectedOutput = overrides.expectedOutput ?? `A reviewable ${title.toLowerCase()} deliverable.`;
  const definitionOfDone = overrides.definitionOfDone ?? [
    'Meets the task objective',
    'Includes verifiable evidence',
    'Documents limitations and next action',
  ];
  return {
    id,
    title,
    objective,
    projectContext:
      'Relay is a shared project control center where humans retain approval authority and agents execute structured work through WebMCP.',
    availableInputs: overrides.availableInputs ?? ['Official challenge rules', 'Relay project brief'],
    expectedOutput,
    definitionOfDone,
    ownerType: overrides.ownerType ?? 'agent',
    assignedAgentId: overrides.assignedAgentId ?? null,
    priority,
    status,
    estimatedEffortHours: overrides.estimatedEffortHours ?? 2,
    dueDate: overrides.dueDate ?? '2026-09-03',
    dependencies,
    labels,
    locked: overrides.locked ?? false,
    approvalRequired: overrides.approvalRequired ?? true,
    completionPercentage: overrides.completionPercentage ?? (status === 'completed' ? 100 : 0),
    progressNotes: overrides.progressNotes ?? [],
    deliverables: overrides.deliverables ?? [],
    clarificationIds: overrides.clarificationIds ?? [],
    packet: {
      objective,
      context:
        'Use only the supplied project context and authoritative sources. Keep human approval boundaries explicit.',
      inputs: overrides.availableInputs ?? ['Official challenge rules', 'Relay project brief'],
      expectedOutput,
      definitionOfDone,
      deadline: overrides.dueDate ?? '2026-09-03',
      dependencies,
      restrictions: ['Do not invent evidence or URLs', 'Do not bypass human approval'],
      approvalRequirements: overrides.approvalRequired === false ? 'No approval required' : 'Human review required before completion',
    },
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  };
};

export function createSeedWorkspace(): Workspace {
  const deliverableId = 'deliv-requirements-1';
  const clarificationId = 'clar-demo-url';
  const tasks: Task[] = [
    task('RP-101', 'Review challenge requirements', 'human_review', 'critical', [], ['requirements', 'research'], {
      assignedAgentId: 'planning-agent',
      completionPercentage: 100,
      deliverables: [
        {
          id: deliverableId,
          taskId: 'RP-101',
          agentId: 'planning-agent',
          summary: 'Verified the current challenge deadline, required artifacts, and judging criteria.',
          content:
            'Relay must provide a working live WebMCP application, public licensed source, an English project description, and a narrated public YouTube demo under three minutes.',
          evidence: [
            'https://webmcp.devpost.com/rules',
            'https://openai.com/webmcp-challenge/',
            'https://learn.chatgpt.com/docs/webmcp',
          ],
          knownLimitations: ['The official rules may be updated before the deadline.'],
          recommendedNextAction: 'Approve the brief and unlock implementation scope.',
          status: 'pending',
          feedback: null,
          createdAt: '2026-08-30T18:20:00.000Z',
          reviewedAt: null,
        },
      ],
    }),
    task('RP-102', 'Define the project scope', 'backlog', 'critical', ['RP-101'], ['planning'], {
      locked: true,
    }),
    task('RP-103', 'Design the interface', 'in_progress', 'high', [], ['design', 'frontend'], {
      assignedAgentId: 'builder-agent',
      completionPercentage: 68,
      progressNotes: [
        {
          id: 'note-design-1',
          agentId: 'builder-agent',
          note: 'Command center and responsive task-board composition are complete.',
          completionPercentage: 68,
          timeSpentMinutes: 74,
          blocker: null,
          missingInformation: null,
          createdAt: '2026-08-30T18:12:00.000Z',
        },
      ],
    }),
    task('RP-104', 'Research WebMCP implementation', 'ready', 'high', [], ['research', 'webmcp'], {
      approvalRequired: false,
      availableInputs: ['WebMCP specification', 'OpenAI Site tools guide', 'Challenge rules'],
    }),
    task('RP-105', 'Implement the task board', 'ready', 'high', [], ['frontend', 'implementation']),
    task('RP-106', 'Register WebMCP tools', 'backlog', 'critical', ['RP-104'], ['webmcp', 'implementation'], {
      locked: true,
    }),
    task('RP-107', 'Test human-agent handoffs', 'backlog', 'critical', ['RP-105', 'RP-106'], ['testing', 'webmcp'], {
      locked: true,
    }),
    task('RP-108', 'Record the demo video', 'blocked', 'high', ['RP-107'], ['video', 'release'], {
      clarificationIds: [clarificationId],
      availableInputs: ['Demo script', 'Deployed application URL'],
    }),
    task('RP-109', 'Review accessibility', 'ready', 'medium', [], ['accessibility', 'review']),
    task('RP-110', 'Deploy the application', 'backlog', 'critical', ['RP-107'], ['deployment'], {
      locked: true,
    }),
    task('RP-111', 'Complete the Devpost entry', 'backlog', 'critical', ['RP-108', 'RP-110'], ['release', 'submission'], {
      ownerType: 'human',
      approvalRequired: false,
      locked: true,
    }),
    task('RP-100', 'Choose the Relay concept', 'completed', 'critical', [], ['planning'], {
      ownerType: 'human',
      approvalRequired: false,
      completionPercentage: 100,
    }),
  ];

  return {
    id: 'relayplan-demo',
    name: 'Launch a WebMCP Challenge Entry',
    goal: 'Build, test, deploy, demonstrate, and submit an agent-native WebMCP application.',
    deadline: '2026-09-03T20:00:00.000Z',
    demoData: true,
    version: 18,
    agents,
    tasks,
    clarifications: [
      {
        id: clarificationId,
        taskId: 'RP-108',
        agentId: 'builder-agent',
        question: 'Which verified production URL should appear in the demo?',
        reason: 'The video must show the same live app submitted to judges.',
        canContinue: false,
        recommendedChoices: ['Wait for the Sites deployment', 'Use another verified public deployment'],
        status: 'pending',
        answer: null,
        createdAt: '2026-08-30T18:30:00.000Z',
        answeredAt: null,
      },
    ],
    activity: [
      {
        id: 'activity-4',
        actorType: 'agent',
        actor: 'Planning Agent',
        action: 'submit_deliverable',
        taskId: 'RP-101',
        previousStatus: 'in_progress',
        newStatus: 'human_review',
        explanation: 'Submitted the verified challenge requirements brief for human approval.',
        createdAt: '2026-08-30T18:20:00.000Z',
      },
      {
        id: 'activity-3',
        actorType: 'agent',
        actor: 'Builder Agent',
        action: 'update_task_progress',
        taskId: 'RP-103',
        previousStatus: 'in_progress',
        newStatus: 'in_progress',
        explanation: 'Updated interface design progress to 68%.',
        createdAt: '2026-08-30T18:12:00.000Z',
      },
      {
        id: 'activity-2',
        actorType: 'system',
        actor: 'Relay',
        action: 'dependencies_evaluated',
        taskId: 'RP-104',
        previousStatus: 'backlog',
        newStatus: 'ready',
        explanation: 'All dependencies are complete; the task is now ready for an agent.',
        createdAt: '2026-08-30T18:01:00.000Z',
      },
      {
        id: 'activity-1',
        actorType: 'human',
        actor: 'Human owner',
        action: 'complete_task',
        taskId: 'RP-100',
        previousStatus: 'in_progress',
        newStatus: 'completed',
        explanation: 'Selected Relay as the challenge concept.',
        createdAt: '2026-08-30T17:55:00.000Z',
      },
    ],
    createdAt,
    updatedAt: '2026-08-30T18:30:00.000Z',
  };
}

