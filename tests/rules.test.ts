/* oxlint-disable typescript/no-floating-promises -- node:test registers promise-returning test handles at module scope. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { activeAssignments, applyWorkspaceAction, getReadyTasks, packetCompleteness, RuleError } from '../lib/rules.ts';
import { createSeedWorkspace } from '../lib/seed-data.ts';

test('ready tasks respect capabilities, dependencies, packet completeness, and capacity', () => {
  const workspace = createSeedWorkspace();
  const builderReady = getReadyTasks(workspace, 'builder-agent').map((task) => task.id);

  assert.deepEqual(builderReady, ['RP-104', 'RP-105']);
  assert.equal(packetCompleteness(workspace.tasks.find((task) => task.id === 'RP-105')!).percentage, 100);
  assert.equal(activeAssignments(workspace, 'builder-agent'), 1);
});

test('an eligible agent can claim a shared task and the transition is audited', () => {
  const result = applyWorkspaceAction(createSeedWorkspace(), {
    type: 'claim_task',
    agentId: 'builder-agent',
    taskId: 'RP-105',
  });
  const task = result.workspace.tasks.find((item) => item.id === 'RP-105')!;

  assert.equal(task.status, 'in_progress');
  assert.equal(task.assignedAgentId, 'builder-agent');
  assert.equal(result.previousStatus, 'ready');
  assert.equal(result.workspace.activity[0].action, 'claim_task');
  assert.equal(result.workspace.version, 19);
});

test('duplicate or ineligible claims are rejected', () => {
  assert.throws(
    () => applyWorkspaceAction(createSeedWorkspace(), { type: 'claim_task', agentId: 'builder-agent', taskId: 'RP-103' }),
    RuleError,
  );
});

test('progress updates preserve blockers and never silently complete work', () => {
  const result = applyWorkspaceAction(createSeedWorkspace(), {
    type: 'update_task_progress',
    agentId: 'builder-agent',
    taskId: 'RP-103',
    note: 'The responsive task board is implemented and needs a keyboard review.',
    completionPercentage: 92,
    timeSpentMinutes: 35,
    blocker: 'Keyboard audit pending',
  });
  const task = result.workspace.tasks.find((item) => item.id === 'RP-103')!;

  assert.equal(task.status, 'blocked');
  assert.equal(task.completionPercentage, 92);
  assert.equal(task.progressNotes.at(-1)?.blocker, 'Keyboard audit pending');
});

test('agent submission enters human review; only approval completes and unlocks dependencies', () => {
  const claimed = applyWorkspaceAction(createSeedWorkspace(), { type: 'claim_task', agentId: 'research-agent', taskId: 'RP-104' });
  const submitted = applyWorkspaceAction(claimed.workspace, {
    type: 'submit_deliverable',
    agentId: 'research-agent',
    taskId: 'RP-104',
    summary: 'Verified WebMCP registration and mutation semantics.',
    content: 'The app feature-detects modelContext, registers narrow schemas, and writes to the same shared workspace.',
    evidence: ['https://learn.chatgpt.com/docs/webmcp'],
    knownLimitations: ['Browser support is availability-dependent.'],
    recommendedNextAction: 'Human review, then unlock implementation.',
  });
  const awaiting = submitted.workspace.tasks.find((task) => task.id === 'RP-104')!;

  assert.equal(awaiting.status, 'human_review');
  assert.notEqual(awaiting.status, 'completed');

  const approved = applyWorkspaceAction(submitted.workspace, { type: 'approve_deliverable', taskId: 'RP-104' });
  assert.equal(approved.workspace.tasks.find((task) => task.id === 'RP-104')?.status, 'completed');
  assert.equal(approved.workspace.tasks.find((task) => task.id === 'RP-106')?.status, 'ready');
  assert.equal(approved.workspace.tasks.find((task) => task.id === 'RP-106')?.locked, false);
});

test('human clarification answers are explicit and resumable', () => {
  const result = applyWorkspaceAction(createSeedWorkspace(), {
    type: 'answer_clarification',
    clarificationId: 'clar-demo-url',
    answer: 'Use the verified RelayPlan Sites production URL.',
  });

  assert.equal(result.workspace.clarifications[0].status, 'answered');
  assert.equal(result.workspace.tasks.find((task) => task.id === 'RP-108')?.status, 'ready');
  assert.equal(result.workspace.activity[0].actorType, 'human');
});

test('reset creates a clean deterministic demo workspace', () => {
  const claimed = applyWorkspaceAction(createSeedWorkspace(), { type: 'claim_task', agentId: 'builder-agent', taskId: 'RP-105' });
  const reset = applyWorkspaceAction(claimed.workspace, { type: 'reset_demo' });

  assert.equal(reset.workspace.version, 18);
  assert.equal(reset.workspace.tasks.find((task) => task.id === 'RP-105')?.status, 'ready');
  assert.equal(reset.summary, 'The demonstration workspace was restored to its original state.');
});
