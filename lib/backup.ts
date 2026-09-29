import { z } from 'zod';
import type { Workspace } from './domain';
const text = z.string().trim().min(1).max(8000);
const id = text.max(100);
const date = z.string().datetime();
export const deadlineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return (
      Number.isFinite(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, 'Use a real calendar date.');
const list = z.array(text.max(1000)).max(20);
const ids = z
  .array(id)
  .max(200)
  .refine(
    (values) => new Set(values).size === values.length,
    'Duplicate references.',
  );
const status = z.enum([
  'backlog',
  'ready',
  'in_progress',
  'human_review',
  'blocked',
  'completed',
]);
const percentage = z.number().min(0).max(100);
const packet = z
  .object({
    objective: text,
    context: text,
    inputs: list,
    expectedOutput: text,
    definitionOfDone: list.min(1),
    deadline: deadlineSchema,
    dependencies: ids,
    restrictions: list,
    approvalRequirements: text,
  })
  .strict();
export const taskDraftSchema = z
  .object({
    title: text.max(160),
    objective: text.max(1200),
    context: text.max(3000),
    inputs: list,
    expectedOutput: text.max(1200),
    definitionOfDone: list.min(1),
    dueDate: deadlineSchema,
    ownerType: z.enum(['human', 'agent']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    labels: z.array(text.max(80)).max(12),
    dependencies: ids,
    restrictions: list,
  })
  .strict();
const agent = z
  .object({
    id,
    name: text.max(100),
    description: text.max(1000),
    capabilities: z.array(text.max(80)).max(12),
    preferredTaskTypes: list,
    maxActiveTasks: z.number().int().min(1).max(20),
    active: z.boolean(),
    completedAssignments: z.number().int().min(0),
  })
  .strict();
const note = z
  .object({
    id,
    agentId: id,
    note: text,
    completionPercentage: percentage,
    timeSpentMinutes: z.number().min(0).max(100000),
    blocker: text.nullable(),
    missingInformation: text.nullable(),
    createdAt: date,
  })
  .strict();
const deliverable = z
  .object({
    id,
    taskId: id,
    agentId: id,
    summary: text,
    content: text,
    evidence: list,
    knownLimitations: list,
    recommendedNextAction: text,
    status: z.enum(['pending', 'approved', 'rejected']),
    feedback: text.nullable(),
    createdAt: date,
    reviewedAt: date.nullable(),
  })
  .strict();
const task = z
  .object({
    id: z
      .string()
      .regex(/^RP-[0-9]{3,}$/)
      .max(20),
    title: text,
    objective: text,
    projectContext: text,
    availableInputs: list,
    expectedOutput: text,
    definitionOfDone: list.min(1),
    ownerType: z.enum(['human', 'agent']),
    assignedAgentId: id.nullable(),
    priority: taskDraftSchema.shape.priority,
    status,
    estimatedEffortHours: z.number().min(0),
    dueDate: deadlineSchema,
    dependencies: ids,
    labels: z.array(text.max(80)).max(12),
    locked: z.boolean(),
    approvalRequired: z.boolean(),
    completionPercentage: percentage,
    progressNotes: z.array(note).max(200),
    deliverables: z.array(deliverable).max(50),
    clarificationIds: ids,
    packet,
    createdAt: date,
    updatedAt: date,
  })
  .strict();
const clarification = z
  .object({
    id,
    taskId: id,
    agentId: id,
    question: text,
    reason: text,
    canContinue: z.boolean(),
    recommendedChoices: list,
    status: z.enum(['pending', 'answered']),
    answer: text.nullable(),
    createdAt: date,
    answeredAt: date.nullable(),
  })
  .strict();
const activity = z
  .object({
    id,
    actorType: z.enum(['human', 'agent', 'system']),
    actor: text,
    action: text,
    taskId: id.nullable(),
    previousStatus: status.nullable(),
    newStatus: status.nullable(),
    explanation: text,
    createdAt: date,
  })
  .strict();
const schema = z
  .object({
    id,
    name: text.max(160),
    goal: text.max(3000),
    deadline: z.union([deadlineSchema, z.literal('')]),
    demoData: z.boolean(),
    version: z.number().int().min(1),
    agents: z.array(agent).min(1).max(20),
    tasks: z.array(task).max(100),
    clarifications: z.array(clarification).max(200),
    activity: z.array(activity).max(100),
    createdAt: date,
    updatedAt: date,
  })
  .strict();

export function parseBackup(input: unknown): Workspace {
  const workspace = schema.parse(input);
  const fail = (message: string): never => {
    throw new Error(`Invalid backup: ${message}`);
  };
  const unique = (values: { id: string }[]) =>
    new Set(values.map((value) => value.id)).size === values.length;
  if (
    ![
      workspace.agents,
      workspace.tasks,
      workspace.clarifications,
      workspace.activity,
    ].every(unique)
  )
    fail('duplicate IDs.');
  for (const task of workspace.tasks) {
    if (
      task.assignedAgentId &&
      !workspace.agents.some(
        (agent) => agent.id === task.assignedAgentId && agent.active,
      )
    )
      fail('unknown or inactive assigned agent.');
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) fail('dependency cycle.');
      if (visited.has(id)) return;
      const item = workspace.tasks.find((task) => task.id === id);
      if (!item) fail('missing dependency.');
      visiting.add(id);
      item!.dependencies.forEach(visit);
      visiting.delete(id);
      visited.add(id);
    };
    visit(task.id);
    if (
      JSON.stringify(task.dependencies) !==
        JSON.stringify(task.packet.dependencies) ||
      task.objective !== task.packet.objective ||
      task.projectContext !== task.packet.context ||
      task.expectedOutput !== task.packet.expectedOutput ||
      task.dueDate !== task.packet.deadline ||
      JSON.stringify(task.definitionOfDone) !==
        JSON.stringify(task.packet.definitionOfDone) ||
      JSON.stringify(task.availableInputs) !==
        JSON.stringify(task.packet.inputs)
    )
      fail('task and packet disagree.');
    const dependenciesDone = task.dependencies.every(
      (id) => workspace.tasks.find((t) => t.id === id)?.status === 'completed',
    );
    const active = ['in_progress', 'blocked', 'human_review'].includes(
      task.status,
    );
    if (
      task.ownerType === 'human' &&
      (task.assignedAgentId ||
        task.deliverables.length ||
        active ||
        task.status === 'ready')
    )
      fail('invalid human task state.');
    if (
      task.ownerType === 'agent' &&
      (!task.approvalRequired ||
        ((active || task.status === 'completed') && !task.assignedAgentId))
    )
      fail('invalid agent task state.');
    if (['ready', 'backlog'].includes(task.status) && task.assignedAgentId)
      fail('unstarted task has an assignment.');
    if (
      (active || ['ready', 'completed'].includes(task.status)) &&
      !dependenciesDone
    )
      fail('unfinished dependency for started work.');
    if (task.locked !== !dependenciesDone)
      fail('inconsistent dependency lock.');
    if (!unique(task.deliverables) || !unique(task.progressNotes))
      fail('duplicate history IDs.');
    for (const delivery of task.deliverables) {
      if (
        delivery.taskId !== task.id ||
        delivery.agentId !== task.assignedAgentId ||
        (delivery.status === 'pending') !== (delivery.reviewedAt === null)
      )
        fail('invalid deliverable reference or review.');
    }
    if (
      task.deliverables.filter((item) => item.status === 'pending').length !==
      (task.status === 'human_review' ? 1 : 0)
    )
      fail('pending review does not match task state.');
    if (
      task.status === 'completed' &&
      (task.completionPercentage !== 100 ||
        (task.ownerType === 'agent' &&
          task.deliverables.at(-1)?.status !== 'approved'))
    )
      fail('completion is missing an approval.');
    const questions = workspace.clarifications.filter(
      (item) => item.taskId === task.id,
    );
    if (
      questions.length !== task.clarificationIds.length ||
      questions.some((item) => !task.clarificationIds.includes(item.id))
    )
      fail('clarification references disagree.');
    const blocked =
      questions.some((q) => q.status === 'pending' && !q.canContinue) ||
      !!task.progressNotes.at(-1)?.blocker ||
      !!task.progressNotes.at(-1)?.missingInformation;
    if (blocked !== (task.status === 'blocked'))
      fail('blockers do not match task state.');
  }
  for (const question of workspace.clarifications) {
    if (
      !workspace.tasks.some(
        (task) =>
          task.id === question.taskId &&
          task.assignedAgentId === question.agentId,
      )
    )
      fail('unknown clarification owner.');
    if (
      (question.status === 'answered') !==
      (question.answer !== null && question.answeredAt !== null)
    )
      fail('invalid clarification answer.');
  }
  return workspace;
}
