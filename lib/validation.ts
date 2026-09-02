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
  if (unknown.length) throw new ValidationError(`Unknown field: ${unknown[0]}.`);
};

const string = (value: unknown, field: string, min = 1, max = 1200) => {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new ValidationError(`${field} must contain ${min}-${max} characters.`);
  }
  return value.trim();
};

const optionalString = (value: unknown, field: string, max = 1200) => {
  if (value === undefined) return undefined;
  return string(value, field, 1, max);
};

const number = (value: unknown, field: string, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  }
  return value;
};

const boolean = (value: unknown, field: string) => {
  if (typeof value !== 'boolean') throw new ValidationError(`${field} must be true or false.`);
  return value;
};

const strings = (value: unknown, field: string, maxItems = 12, maxLength = 500) => {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ValidationError(`${field} must be an array with at most ${maxItems} items.`);
  }
  return value.map((item, index) => string(item, `${field}[${index}]`, 1, maxLength));
};

export function parseWorkspaceAction(input: unknown): WorkspaceAction {
  const value = object(input);
  const type = string(value.type, 'type', 1, 60) as WorkspaceAction['type'];
  if (type === 'claim_task') {
    exact(value, ['type', 'agentId', 'taskId']);
    return { type, agentId: string(value.agentId, 'agentId', 1, 80), taskId: string(value.taskId, 'taskId', 1, 80) };
  }
  if (type === 'update_task_progress') {
    exact(value, ['type', 'agentId', 'taskId', 'note', 'completionPercentage', 'timeSpentMinutes', 'blocker', 'missingInformation']);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
      note: string(value.note, 'note', 2, 800),
      completionPercentage: number(value.completionPercentage, 'completionPercentage', 0, 100),
      timeSpentMinutes: number(value.timeSpentMinutes, 'timeSpentMinutes', 0, 100000),
      blocker: optionalString(value.blocker, 'blocker', 800),
      missingInformation: optionalString(value.missingInformation, 'missingInformation', 800),
    };
  }
  if (type === 'submit_deliverable') {
    exact(value, ['type', 'agentId', 'taskId', 'summary', 'content', 'evidence', 'knownLimitations', 'recommendedNextAction']);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
      summary: string(value.summary, 'summary', 2, 800),
      content: string(value.content, 'content', 2, 8000),
      evidence: strings(value.evidence, 'evidence', 20, 1000),
      knownLimitations: strings(value.knownLimitations, 'knownLimitations', 20, 1000),
      recommendedNextAction: string(value.recommendedNextAction, 'recommendedNextAction', 2, 1000),
    };
  }
  if (type === 'request_human_input') {
    exact(value, ['type', 'agentId', 'taskId', 'question', 'reason', 'canContinue', 'recommendedChoices']);
    return {
      type,
      agentId: string(value.agentId, 'agentId', 1, 80),
      taskId: string(value.taskId, 'taskId', 1, 80),
      question: string(value.question, 'question', 2, 1000),
      reason: string(value.reason, 'reason', 2, 1000),
      canContinue: boolean(value.canContinue, 'canContinue'),
      recommendedChoices: strings(value.recommendedChoices, 'recommendedChoices', 8, 500),
    };
  }
  if (type === 'approve_deliverable') {
    exact(value, ['type', 'taskId', 'feedback']);
    return { type, taskId: string(value.taskId, 'taskId', 1, 80), feedback: optionalString(value.feedback, 'feedback', 1000) };
  }
  if (type === 'reject_deliverable') {
    exact(value, ['type', 'taskId', 'feedback']);
    return { type, taskId: string(value.taskId, 'taskId', 1, 80), feedback: string(value.feedback, 'feedback', 2, 1000) };
  }
  if (type === 'answer_clarification') {
    exact(value, ['type', 'clarificationId', 'answer']);
    return { type, clarificationId: string(value.clarificationId, 'clarificationId', 1, 100), answer: string(value.answer, 'answer', 2, 1500) };
  }
  if (type === 'reset_demo') {
    exact(value, ['type']);
    return { type };
  }
  throw new ValidationError(`Unsupported action type: ${String(type)}.`);
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Relay request failed.';
  const status = error instanceof ValidationError ? 400 : error instanceof Error && error.name === 'RuleError' ? 409 : 500;
  return Response.json({ success: false, error: message }, { status });
}

