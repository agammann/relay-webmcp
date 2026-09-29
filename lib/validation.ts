import { deadlineSchema, parseBackup, taskDraftSchema } from './backup.ts';
import type { WorkspaceAction } from './domain';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const object = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Expected a JSON object.');
  }
  return value as Record<string, unknown>;
};

const exact = (value: Record<string, unknown>, allowed: string[]) => {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new ValidationError(`Unknown field: ${unknown[0]}.`);
};

const string = (value: unknown, field: string, min = 1, max = 1200) => {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max
  ) {
    throw new ValidationError(
      `${field} must contain ${min}-${max} characters.`,
    );
  }
  return value.trim();
};

const optionalString = (value: unknown, field: string, max = 1200) => {
  if (value === undefined) return undefined;
  return string(value, field, 1, max);
};

const number = (value: unknown, field: string, min: number, max: number) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  }
  return value;
};

const boolean = (value: unknown, field: string) => {
  if (typeof value !== 'boolean')
    throw new ValidationError(`${field} must be true or false.`);
  return value;
};

const strings = (
  value: unknown,
  field: string,
  maxItems = 12,
  maxLength = 500,
) => {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ValidationError(
      `${field} must be an array with at most ${maxItems} items.`,
    );
  }
  return value.map((item, index) =>
    string(item, `${field}[${index}]`, 1, maxLength),
  );
};

export function parseWorkspaceAction(input: unknown): WorkspaceAction {
  const value = object(input);
  const type = string(value.type, 'type', 1, 60) as WorkspaceAction['type'];
  if (type === 'claim_task') {
    exact(value, ['type', 'agentId', 'taskId']);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
    };
  }
  if (type === 'update_task_progress') {
    exact(value, [
      'type',
      'agentId',
      'taskId',
      'note',
      'completionPercentage',
      'timeSpentMinutes',
      'blocker',
      'missingInformation',
    ]);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
      note: string(value.note, 'note', 2, 800),
      completionPercentage: number(
        value.completionPercentage,
        'completionPercentage',
        0,
        99,
      ),
      timeSpentMinutes: number(
        value.timeSpentMinutes,
        'timeSpentMinutes',
        0,
        100000,
      ),
      blocker: optionalString(value.blocker, 'blocker', 800),
      missingInformation: optionalString(
        value.missingInformation,
        'missingInformation',
        800,
      ),
    };
  }
  if (type === 'submit_deliverable') {
    exact(value, [
      'type',
      'agentId',
      'taskId',
      'summary',
      'content',
      'evidence',
      'knownLimitations',
      'recommendedNextAction',
    ]);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
      summary: string(value.summary, 'summary', 2, 800),
      content: string(value.content, 'content', 2, 8000),
      evidence: strings(value.evidence, 'evidence', 20, 1000),
      knownLimitations: strings(
        value.knownLimitations,
        'knownLimitations',
        20,
        1000,
      ),
      recommendedNextAction: string(
        value.recommendedNextAction,
        'recommendedNextAction',
        2,
        1000,
      ),
    };
  }
  if (type === 'request_human_input') {
    exact(value, [
      'type',
      'agentId',
      'taskId',
      'question',
      'reason',
      'canContinue',
      'recommendedChoices',
    ]);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
      question: string(value.question, 'question', 2, 1000),
      reason: string(value.reason, 'reason', 2, 1000),
      canContinue: boolean(value.canContinue, 'canContinue'),
      recommendedChoices: strings(
        value.recommendedChoices,
        'recommendedChoices',
        8,
        500,
      ),
    };
  }
  if (type === 'approve_deliverable') {
    exact(value, ['type', 'taskId', 'feedback']);
    return {
      type,
      taskId: string(value.taskId, 'taskId', 1, 80),
      feedback: optionalString(value.feedback, 'feedback', 1000),
    };
  }
  if (type === 'reject_deliverable') {
    exact(value, ['type', 'taskId', 'feedback']);
    return {
      type,
      taskId: string(value.taskId, 'taskId', 1, 80),
      feedback: string(value.feedback, 'feedback', 2, 1000),
    };
  }
  if (type === 'answer_clarification') {
    exact(value, ['type', 'clarificationId', 'answer']);
    return {
      type,
      clarificationId: string(value.clarificationId, 'clarificationId', 1, 100),
      answer: string(value.answer, 'answer', 2, 1500),
    };
  }
  if (type === 'update_project') {
    exact(value, ['type', 'name', 'goal', 'deadline']);
    const deadline =
      value.deadline === '' ? '' : deadlineSchema.parse(value.deadline);
    return {
      type,
      name: string(value.name, 'name', 1, 160),
      goal: string(value.goal, 'goal', 1, 3000),
      deadline,
    };
  }
  if (type === 'create_task' || type === 'edit_task') {
    exact(
      value,
      type === 'create_task' ? ['type', 'task'] : ['type', 'taskId', 'task'],
    );
    const task = taskDraftSchema.parse(value.task);
    return type === 'create_task'
      ? { type, task }
      : { type, taskId: string(value.taskId, 'taskId', 1, 80), task };
  }
  if (type === 'delete_task') {
    exact(value, ['type', 'taskId']);
    return { type, taskId: string(value.taskId, 'taskId', 1, 80) };
  }
  if (type === 'complete_human_task') {
    exact(value, ['type', 'taskId', 'result']);
    return {
      type,
      taskId: string(value.taskId, 'taskId', 1, 80),
      result: string(value.result, 'result', 2, 1000),
    };
  }
  if (type === 'add_agent') {
    exact(value, [
      'type',
      'name',
      'description',
      'capabilities',
      'maxActiveTasks',
    ]);
    const maxActiveTasks = number(
      value.maxActiveTasks,
      'maxActiveTasks',
      1,
      20,
    );
    if (!Number.isInteger(maxActiveTasks))
      throw new ValidationError('Capacity must be a whole number.');
    return {
      type,
      name: string(value.name, 'name', 1, 100),
      description: string(value.description, 'description', 1, 1000),
      capabilities: strings(value.capabilities, 'capabilities', 12, 80),
      maxActiveTasks,
    };
  }
  if (type === 'import_workspace') {
    exact(value, ['type', 'workspace']);
    try {
      return { type, workspace: parseBackup(value.workspace) };
    } catch (error) {
      throw new ValidationError(
        error instanceof Error && error.message.startsWith('Invalid backup:')
          ? error.message
          : 'Backup does not match the Relay workspace format.',
      );
    }
  }
  if (type === 'reset_demo' || type === 'new_project') {
    exact(value, ['type']);
    return { type };
  }
  throw new ValidationError(`Unsupported action type: ${String(type)}.`);
}

export function apiError(error: unknown) {
  const invalid =
    error instanceof ValidationError ||
    error instanceof SyntaxError ||
    (error instanceof Error && error.name === 'ZodError');
  const conflict = error instanceof Error && error.name === 'RuleError';
  const message = invalid
    ? error instanceof ValidationError
      ? error.message
      : 'Invalid input. Check required fields, dates, and field limits.'
    : conflict
      ? (error as Error).message
      : 'Workspace storage is unavailable. Please retry later.';
  return Response.json(
    { success: false, error: message },
    {
      status: invalid ? 400 : conflict ? 409 : 503,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
