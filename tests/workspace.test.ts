/* oxlint-disable typescript/no-floating-promises -- node:test handles registered promises. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedWorkspace } from '../lib/seed-data.ts';
import { createTask, createWorkspace } from '../lib/project.ts';
import {
  applyWorkspaceAction,
  getReadyTasks,
  RuleError,
} from '../lib/rules.ts';
import { parseBackup } from '../lib/backup.ts';
import { parseWorkspaceAction } from '../lib/validation.ts';
import { readSession } from '../lib/session.ts';
import type { Workspace, WorkspaceAction } from '../lib/domain';

const apply = (workspace: Workspace, action: WorkspaceAction) =>
  applyWorkspaceAction(workspace, parseWorkspaceAction(action)).workspace;
const claim = () =>
  apply(createSeedWorkspace(), {
    type: 'claim_task',
    taskId: 'RP-101',
    agentId: 'planning-agent',
  });
const delivery: WorkspaceAction = {
  type: 'submit_deliverable',
  taskId: 'RP-101',
  agentId: 'planning-agent',
  summary: 'Choose balcony herbs',
  content:
    'Teach basic herb planting in a container, with a short hands-on session.',
  evidence: [],
  knownLimitations: ['Organizer must confirm material costs.'],
  recommendedNextAction: 'Review the workshop topic.',
};
const question = (question: string): WorkspaceAction => ({
  type: 'request_human_input',
  taskId: 'RP-101',
  agentId: 'planning-agent',
  question,
  reason: 'Needed for scope.',
  canContinue: false,
  recommendedChoices: [],
});
const progress: WorkspaceAction = {
  type: 'update_task_progress',
  taskId: 'RP-101',
  agentId: 'planning-agent',
  note: 'Planning resumed.',
  completionPercentage: 50,
  timeSpentMinutes: 10,
};

test('a fresh workspace is empty; examples have no fictional work history', () => {
  assert.equal(createWorkspace('test').tasks.length, 0);
  const example = createSeedWorkspace();
  assert.equal(example.tasks.length, 3);
  assert.equal(example.activity.length, 0);
  assert.equal(
    example.tasks.every((task) => !task.deliverables.length),
    true,
  );
});
test('readiness requires complete packets, matching profile, dependency completion and capacity', () => {
  const workspace = createSeedWorkspace();
  assert.deepEqual(
    getReadyTasks(workspace, 'planning-agent').map((t) => t.id),
    ['RP-101'],
  );
  assert.deepEqual(
    getReadyTasks(workspace, 'research-agent', ['planning']),
    [],
  );
  assert.throws(() => getReadyTasks(workspace, 'missing'), RuleError);
  workspace.tasks[0].packet.context = '  ';
  assert.deepEqual(getReadyTasks(workspace), []);
  workspace.tasks[0].packet.context = 'A real goal';
  workspace.agents[0].maxActiveTasks = 1;
  const assigned = apply(workspace, {
    type: 'claim_task',
    taskId: 'RP-101',
    agentId: 'planning-agent',
  });
  const extra = structuredClone(assigned.tasks[0]);
  extra.id = 'RP-104';
  extra.assignedAgentId = null;
  extra.status = 'ready';
  assigned.tasks.push(extra);
  assert.deepEqual(getReadyTasks(assigned, 'planning-agent'), []);
});
test('duplicate claims reject and never mutate the original state', () => {
  const before = createSeedWorkspace();
  const after = apply(before, {
    type: 'claim_task',
    taskId: 'RP-101',
    agentId: 'planning-agent',
  });
  assert.equal(before.tasks[0].status, 'ready');
  assert.equal(after.tasks[0].status, 'in_progress');
  assert.throws(
    () =>
      apply(after, {
        type: 'claim_task',
        taskId: 'RP-101',
        agentId: 'planning-agent',
      }),
    RuleError,
  );
});
test('multiple blocking questions cannot be bypassed with progress or one answer', () => {
  let w = apply(
    apply(claim(), question('How many guests?')),
    question('Which venue?'),
  );
  w = apply(w, progress);
  assert.equal(w.tasks[0].status, 'blocked');
  assert.throws(() => apply(w, delivery), RuleError);
  w = apply(w, {
    type: 'answer_clarification',
    clarificationId: w.clarifications[0].id,
    answer: 'Twelve guests.',
  });
  assert.equal(w.tasks[0].status, 'blocked');
  w = apply(w, {
    type: 'answer_clarification',
    clarificationId: w.clarifications[1].id,
    answer: 'Community center.',
  });
  assert.equal(w.tasks[0].status, 'in_progress');
  assert.equal(w.clarifications[0].answer, 'Twelve guests.');
});
test('answering a question does not clear a separately reported progress blocker', () => {
  let w = apply(
    apply(claim(), { ...progress, blocker: 'Materials unavailable' }),
    question('How many guests?'),
  );
  w = apply(w, {
    type: 'answer_clarification',
    clarificationId: w.clarifications[0].id,
    answer: 'Twelve guests.',
  });
  assert.equal(w.tasks[0].status, 'blocked');
  w = apply(w, progress);
  assert.equal(w.tasks[0].status, 'in_progress');
});
test('revision history survives resubmission; approval alone unlocks dependent work', () => {
  let w = apply(claim(), delivery);
  assert.equal(w.tasks[0].status, 'human_review');
  assert.equal(w.tasks[1].status, 'backlog');
  w = apply(w, {
    type: 'reject_deliverable',
    taskId: 'RP-101',
    feedback: 'Specify the audience.',
  });
  assert.equal(w.tasks[0].deliverables[0].feedback, 'Specify the audience.');
  w = apply(w, delivery);
  w = apply(w, {
    type: 'approve_deliverable',
    taskId: 'RP-101',
    feedback: 'Reviewed and accepted.',
  });
  assert.equal(w.tasks[0].status, 'completed');
  assert.equal(w.tasks[1].status, 'ready');
  assert.equal(w.tasks[0].deliverables.length, 2);
  assert.equal(w.agents[0].completedAssignments, 1);
  assert.deepEqual(parseBackup(w), w);
});
test('human tasks complete with a recorded result and unlock dependencies', () => {
  const w = createSeedWorkspace();
  w.tasks[0].ownerType = 'human';
  w.tasks[0].status = 'backlog';
  w.tasks[0].approvalRequired = false;
  const after = apply(w, {
    type: 'complete_human_task',
    taskId: 'RP-101',
    result: 'Confirmed a balcony-herb session with organizer.',
  });
  assert.equal(after.tasks[0].status, 'completed');
  assert.equal(after.tasks[0].progressNotes[0].agentId, 'human');
  assert.equal(after.tasks[1].status, 'ready');
  assert.throws(
    () =>
      apply(w, {
        type: 'complete_human_task',
        taskId: 'RP-103',
        result: 'Too early.',
      }),
    RuleError,
  );
});
test('editing refuses dependency cycles and claimed tasks; deletion refuses dependents', () => {
  const w = createSeedWorkspace();
  const t = w.tasks[0];
  const draft = {
    title: t.title,
    objective: t.objective,
    context: t.projectContext,
    inputs: t.availableInputs,
    expectedOutput: t.expectedOutput,
    definitionOfDone: t.definitionOfDone,
    dueDate: t.dueDate,
    ownerType: 'agent' as const,
    priority: t.priority,
    labels: t.labels,
    dependencies: ['RP-102'],
    restrictions: [],
  };
  assert.throws(
    () => apply(w, { type: 'edit_task', taskId: t.id, task: draft }),
    RuleError,
  );
  assert.throws(
    () =>
      apply(claim(), {
        type: 'edit_task',
        taskId: t.id,
        task: { ...draft, dependencies: [] },
      }),
    RuleError,
  );
  assert.throws(
    () => apply(w, { type: 'delete_task', taskId: t.id }),
    RuleError,
  );
  assert.equal(
    apply(w, { type: 'delete_task', taskId: 'RP-103' }).tasks.length,
    2,
  );
  assert.equal(
    createTask('RP-999', { ...draft, dependencies: [] }).packet.objective,
    t.objective,
  );
});
test('new project, example, and restore preserve browser identity and monotonic version', () => {
  let w = createWorkspace('browser-one');
  w = apply(w, { type: 'reset_demo' });
  assert.equal(w.id, 'browser-one');
  assert.equal(w.version, 2);
  const backup = structuredClone(w);
  w = apply(w, { type: 'new_project' });
  assert.equal(w.version, 3);
  assert.equal(w.tasks.length, 0);
  backup.id = 'another-browser';
  w = apply(w, { type: 'import_workspace', workspace: backup });
  assert.equal(w.id, 'browser-one');
  assert.equal(w.version, 4);
  assert.equal(w.tasks.length, 3);
});
test('backups reject malformed structures, missing references and invented completion', () => {
  const w = createSeedWorkspace();
  assert.deepEqual(parseBackup(w), w);
  assert.throws(() => parseBackup({ ...w, tasks: [{ title: 'Incomplete' }] }));
  w.tasks[0].status = 'completed';
  assert.throws(() => parseBackup(w));
  w.tasks[0].status = 'ready';
  w.tasks[0].dependencies = ['RP-404'];
  w.tasks[0].packet.dependencies = ['RP-404'];
  assert.throws(() => parseBackup(w));
});
test('sessions are browser-bound and workspace IDs are not cookie credentials', async () => {
  const request = new Request('https://relay.example/api/workspace');
  assert.equal(await readSession(request, false), null);
  const one = (await readSession(request, true))!;
  const two = (await readSession(request, true))!;
  assert.notEqual(one.id, two.id);
  assert.match(one.cookie, /HttpOnly; SameSite=Strict/);
  assert.match(one.cookie, /Secure/);
  const cookie = one.cookie.split(';')[0];
  assert.notEqual(one.id, cookie.split('=')[1]);
  const restored = (await readSession(
    new Request(request.url, { headers: { cookie } }),
    false,
  ))!;
  assert.equal(restored.id, one.id);
});
