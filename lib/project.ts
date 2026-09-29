import type { AgentProfile, Task, Workspace } from './domain';

export interface TaskDraft {
  title: string;
  objective: string;
  context: string;
  inputs: string[];
  expectedOutput: string;
  definitionOfDone: string[];
  dueDate: string;
  ownerType: 'human' | 'agent';
  priority: Task['priority'];
  labels: string[];
  dependencies: string[];
  restrictions: string[];
}

const profiles: AgentProfile[] = [
  {
    id: 'planning-agent',
    name: 'Planning Agent',
    description: 'Planning and coordination',
    capabilities: ['planning', 'requirements', 'coordination'],
    preferredTaskTypes: [],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 0,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Research and documentation',
    capabilities: ['research', 'documentation'],
    preferredTaskTypes: [],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 0,
  },
  {
    id: 'builder-agent',
    name: 'Builder Agent',
    description: 'Implementation and testing',
    capabilities: ['frontend', 'backend', 'implementation', 'testing'],
    preferredTaskTypes: [],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 0,
  },
  {
    id: 'reviewer-agent',
    name: 'Reviewer Agent',
    description: 'Quality and accessibility review',
    capabilities: ['review', 'accessibility', 'testing'],
    preferredTaskTypes: [],
    maxActiveTasks: 2,
    active: true,
    completedAssignments: 0,
  },
];

export function createWorkspace(id: string): Workspace {
  const timestamp = new Date().toISOString();
  return {
    id,
    name: 'My project',
    goal: 'Give this project a goal, then add your first task.',
    deadline: '',
    demoData: false,
    version: 1,
    agents: structuredClone(profiles),
    tasks: [],
    clarifications: [],
    activity: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createTask(id: string, draft: TaskDraft): Task {
  const timestamp = new Date().toISOString();
  return {
    id,
    title: draft.title,
    objective: draft.objective,
    projectContext: draft.context,
    availableInputs: draft.inputs,
    expectedOutput: draft.expectedOutput,
    definitionOfDone: draft.definitionOfDone,
    ownerType: draft.ownerType,
    priority: draft.priority,
    labels: draft.labels,
    dependencies: draft.dependencies,
    dueDate: draft.dueDate,
    assignedAgentId: null,
    status:
      draft.ownerType === 'agent' && !draft.dependencies.length
        ? 'ready'
        : 'backlog',
    estimatedEffortHours: 0,
    locked: !!draft.dependencies.length,
    approvalRequired: draft.ownerType === 'agent',
    completionPercentage: 0,
    progressNotes: [],
    deliverables: [],
    clarificationIds: [],
    packet: {
      objective: draft.objective,
      context: draft.context,
      inputs: draft.inputs,
      expectedOutput: draft.expectedOutput,
      definitionOfDone: draft.definitionOfDone,
      deadline: draft.dueDate,
      dependencies: draft.dependencies,
      restrictions: draft.restrictions,
      approvalRequirements:
        draft.ownerType === 'agent'
          ? 'Submit a deliverable for review before completion.'
          : 'Record the result before marking complete.',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
