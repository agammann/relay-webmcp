import type {
  ActionResult,
  ActivityEvent,
  AgentProfile,
  Task,
  TaskStatus,
  Workspace,
  WorkspaceAction,
} from './domain';
import { createSeedWorkspace } from './seed-data.ts';

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

const requiredPacketFields = (task: Task) => [
  task.packet.objective,
  task.packet.context,
  task.packet.expectedOutput,
  task.packet.deadline,
  task.packet.approvalRequirements,
  task.packet.definitionOfDone.length ? 'definition' : '',
];

export function packetCompleteness(task: Task) {
  const fields = requiredPacketFields(task);
  const complete = fields.filter(Boolean).length;
  return {
    complete: complete === fields.length,
    percentage: Math.round((complete / fields.length) * 100),
    warning:
      complete === fields.length
        ? null
        : 'This task packet is missing context required for reliable agent work.',
  };
}

export function dependenciesComplete(workspace: Workspace, task: Task) {
  return task.dependencies.every(
    (dependencyId) => workspace.tasks.find((item) => item.id === dependencyId)?.status === 'completed',
  );
}

export function activeAssignments(workspace: Workspace, agentId: string) {
  return workspace.tasks.filter(
    (task) => task.assignedAgentId === agentId && ['in_progress', 'blocked', 'human_review'].includes(task.status),
  ).length;
}

export function agentHasCapacity(workspace: Workspace, agent: AgentProfile) {
  return activeAssignments(workspace, agent.id) < agent.maxActiveTasks;
}

export function getReadyTasks(workspace: Workspace, agentId?: string, capabilities: string[] = []) {
  const agent = agentId ? workspace.agents.find((item) => item.id === agentId) : null;
  const filters = capabilities.length ? capabilities : (agent?.capabilities ?? []);
  return workspace.tasks.filter((task) => {
    if (
      task.status !== 'ready' ||
      task.ownerType !== 'agent' ||
      task.assignedAgentId ||
      task.locked ||
      !dependenciesComplete(workspace, task)
    ) {
      return false;
    }
    if (agent && (!agent.active || !agentHasCapacity(workspace, agent))) return false;
    if (!filters.length) return true;
    return task.labels.some((label) => filters.includes(label));
  });
}

const addActivity = (
  workspace: Workspace,
  event: Omit<ActivityEvent, 'id' | 'createdAt'>,
) => {
  workspace.activity.unshift({ ...event, id: crypto.randomUUID(), createdAt: now() });
  workspace.activity = workspace.activity.slice(0, 100);
};

const refreshDependents = (workspace: Workspace) => {
  const changed: string[] = [];
  for (const task of workspace.tasks) {
    if (!['backlog', 'ready'].includes(task.status)) continue;
    const ready = dependenciesComplete(workspace, task);
    const nextStatus: TaskStatus = ready && task.ownerType === 'agent' ? 'ready' : 'backlog';
    const nextLocked = !ready;
    if (task.status !== nextStatus || task.locked !== nextLocked) {
      const previousStatus = task.status;
      task.status = nextStatus;
      task.locked = nextLocked;
      task.updatedAt = now();
      changed.push(task.id);
      addActivity(workspace, {
        actorType: 'system',
        actor: 'RelayPlan',
        action: 'dependencies_evaluated',
        taskId: task.id,
        previousStatus,
        newStatus: nextStatus,
        explanation: ready
          ? 'All dependencies are complete; the task is now ready.'
          : 'The task remains locked until its dependencies are complete.',
      });
    }
  }
  return changed;
};

const taskFor = (workspace: Workspace, taskId: string) => {
  const task = workspace.tasks.find((item) => item.id === taskId);
  if (!task) throw new RuleError(`Task ${taskId} does not exist.`);
  return task;
};

const agentFor = (workspace: Workspace, agentId: string) => {
  const agent = workspace.agents.find((item) => item.id === agentId);
  if (!agent || !agent.active) throw new RuleError(`Agent ${agentId} is not active.`);
  return agent;
};

const requireAssignment = (workspace: Workspace, taskId: string, agentId: string) => {
  const task = taskFor(workspace, taskId);
  agentFor(workspace, agentId);
  if (task.assignedAgentId !== agentId) {
    throw new RuleError(`Task ${taskId} is not assigned to ${agentId}.`);
  }
  return task;
};

export function applyWorkspaceAction(current: Workspace, action: WorkspaceAction): ActionResult {
  if (action.type === 'reset_demo') {
    const workspace = createSeedWorkspace();
    return {
      workspace,
      action: action.type,
      taskId: null,
      agentId: null,
      previousStatus: null,
      currentStatus: null,
      changedEntityIds: [workspace.id],
      warnings: [],
      summary: 'The demonstration workspace was restored to its original state.',
    };
  }

  const workspace = clone(current);
  let task: Task | null = null;
  let previousStatus: TaskStatus | null = null;
  let agentId: string | null = 'agentId' in action ? action.agentId : null;
  let summary = '';
  const changedEntityIds: string[] = [];
  const warnings: string[] = [];

  if (action.type === 'claim_task') {
    task = taskFor(workspace, action.taskId);
    const agent = agentFor(workspace, action.agentId);
    previousStatus = task.status;
    if (!getReadyTasks(workspace, action.agentId).some((item) => item.id === action.taskId)) {
      throw new RuleError('The task is not currently available for this agent to claim.');
    }
    if (!agentHasCapacity(workspace, agent)) throw new RuleError(`${agent.name} is already at capacity.`);
    task.assignedAgentId = agent.id;
    task.status = 'in_progress';
    task.updatedAt = now();
    changedEntityIds.push(task.id, agent.id);
    summary = `${agent.name} claimed ${task.id}; it is now in progress.`;
    addActivity(workspace, {
      actorType: 'agent',
      actor: agent.name,
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
  } else if (action.type === 'update_task_progress') {
    task = requireAssignment(workspace, action.taskId, action.agentId);
    previousStatus = task.status;
    if (!['in_progress', 'blocked'].includes(task.status)) {
      throw new RuleError('Progress can only be updated on in-progress or blocked work.');
    }
    task.completionPercentage = Math.min(99, Math.max(0, action.completionPercentage));
    task.progressNotes.push({
      id: crypto.randomUUID(),
      agentId: action.agentId,
      note: action.note,
      completionPercentage: task.completionPercentage,
      timeSpentMinutes: action.timeSpentMinutes,
      blocker: action.blocker?.trim() || null,
      missingInformation: action.missingInformation?.trim() || null,
      createdAt: now(),
    });
    if (action.blocker?.trim() || action.missingInformation?.trim()) task.status = 'blocked';
    else if (task.status === 'blocked') task.status = 'in_progress';
    task.updatedAt = now();
    changedEntityIds.push(task.id);
    summary = `${workspace.agents.find((item) => item.id === action.agentId)?.name} updated ${task.id} to ${task.completionPercentage}%.`;
    addActivity(workspace, {
      actorType: 'agent',
      actor: workspace.agents.find((item) => item.id === action.agentId)?.name ?? action.agentId,
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
  } else if (action.type === 'submit_deliverable') {
    task = requireAssignment(workspace, action.taskId, action.agentId);
    previousStatus = task.status;
    if (!['in_progress', 'blocked'].includes(task.status)) {
      throw new RuleError('A deliverable can only be submitted for active work.');
    }
    const deliverableId = crypto.randomUUID();
    task.deliverables.push({
      id: deliverableId,
      taskId: task.id,
      agentId: action.agentId,
      summary: action.summary,
      content: action.content,
      evidence: action.evidence,
      knownLimitations: action.knownLimitations,
      recommendedNextAction: action.recommendedNextAction,
      status: 'pending',
      feedback: null,
      createdAt: now(),
      reviewedAt: null,
    });
    task.completionPercentage = 100;
    task.status = 'human_review';
    task.updatedAt = now();
    changedEntityIds.push(task.id, deliverableId);
    summary = `${workspace.agents.find((item) => item.id === action.agentId)?.name} submitted ${task.id} for human review.`;
    addActivity(workspace, {
      actorType: 'agent',
      actor: workspace.agents.find((item) => item.id === action.agentId)?.name ?? action.agentId,
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
  } else if (action.type === 'request_human_input') {
    task = requireAssignment(workspace, action.taskId, action.agentId);
    previousStatus = task.status;
    if (!['in_progress', 'blocked'].includes(task.status)) {
      throw new RuleError('Human input can only be requested for active work.');
    }
    const clarificationId = crypto.randomUUID();
    workspace.clarifications.push({
      id: clarificationId,
      taskId: task.id,
      agentId: action.agentId,
      question: action.question,
      reason: action.reason,
      canContinue: action.canContinue,
      recommendedChoices: action.recommendedChoices,
      status: 'pending',
      answer: null,
      createdAt: now(),
      answeredAt: null,
    });
    task.clarificationIds.push(clarificationId);
    if (!action.canContinue) task.status = 'blocked';
    task.updatedAt = now();
    changedEntityIds.push(task.id, clarificationId);
    summary = `${workspace.agents.find((item) => item.id === action.agentId)?.name} requested human input for ${task.id}.`;
    addActivity(workspace, {
      actorType: 'agent',
      actor: workspace.agents.find((item) => item.id === action.agentId)?.name ?? action.agentId,
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
  } else if (action.type === 'approve_deliverable') {
    task = taskFor(workspace, action.taskId);
    previousStatus = task.status;
    if (task.status !== 'human_review') throw new RuleError('Only work in Human Review can be approved.');
    const deliverable = [...task.deliverables].reverse().find((item) => item.status === 'pending');
    if (!deliverable) throw new RuleError('No pending deliverable is available to approve.');
    deliverable.status = 'approved';
    deliverable.feedback = action.feedback?.trim() || null;
    deliverable.reviewedAt = now();
    task.status = 'completed';
    task.completionPercentage = 100;
    task.updatedAt = now();
    const assignedAgentId = task.assignedAgentId;
    const agent = assignedAgentId
      ? workspace.agents.find((item) => item.id === assignedAgentId)
      : null;
    if (agent) agent.completedAssignments += 1;
    changedEntityIds.push(task.id, deliverable.id);
    summary = `The human owner approved ${task.id}; the task is complete.`;
    addActivity(workspace, {
      actorType: 'human',
      actor: 'Human owner',
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
    changedEntityIds.push(...refreshDependents(workspace));
  } else if (action.type === 'reject_deliverable') {
    task = taskFor(workspace, action.taskId);
    previousStatus = task.status;
    if (task.status !== 'human_review') throw new RuleError('Only work in Human Review can be rejected.');
    const deliverable = [...task.deliverables].reverse().find((item) => item.status === 'pending');
    if (!deliverable) throw new RuleError('No pending deliverable is available to reject.');
    deliverable.status = 'rejected';
    deliverable.feedback = action.feedback.trim();
    deliverable.reviewedAt = now();
    task.status = 'in_progress';
    task.completionPercentage = Math.min(task.completionPercentage, 90);
    task.updatedAt = now();
    changedEntityIds.push(task.id, deliverable.id);
    summary = `The human owner requested revisions on ${task.id}.`;
    addActivity(workspace, {
      actorType: 'human',
      actor: 'Human owner',
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
  } else {
    const clarification = workspace.clarifications.find(
      (item) => item.id === action.clarificationId,
    );
    if (!clarification || clarification.status !== 'pending') {
      throw new RuleError('That clarification request is not pending.');
    }
    task = taskFor(workspace, clarification.taskId);
    previousStatus = task.status;
    clarification.status = 'answered';
    clarification.answer = action.answer;
    clarification.answeredAt = now();
    if (task.status === 'blocked') task.status = task.assignedAgentId ? 'in_progress' : 'ready';
    task.updatedAt = now();
    agentId = clarification.agentId;
    changedEntityIds.push(task.id, clarification.id);
    summary = `The human owner answered the clarification for ${task.id}.`;
    addActivity(workspace, {
      actorType: 'human',
      actor: 'Human owner',
      action: action.type,
      taskId: task.id,
      previousStatus,
      newStatus: task.status,
      explanation: summary,
    });
  }

  workspace.version += 1;
  workspace.updatedAt = now();
  const taskId = 'taskId' in action ? action.taskId : task?.id ?? null;
  const currentStatus = taskId ? taskFor(workspace, taskId).status : null;
  if (taskId) {
    const completeness = packetCompleteness(taskFor(workspace, taskId));
    if (completeness.warning) warnings.push(completeness.warning);
  }
  return {
    workspace,
    action: action.type,
    taskId,
    agentId,
    previousStatus,
    currentStatus,
    changedEntityIds: [...new Set(changedEntityIds)],
    warnings,
    summary,
  };
}
