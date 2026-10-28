import assert from 'node:assert/strict';
import test from 'node:test';
import { deadlineSchema, parseBackup, taskDraftSchema } from '../lib/backup.ts';
import { createSeedWorkspace } from '../lib/seed-data.ts';
import { apiError } from '../lib/validation.ts';

const draft = {
  title: '  Review scope  ',
  objective: 'Review scope.',
  context: 'Project context.',
  inputs: [],
  expectedOutput: 'Reviewed scope.',
  definitionOfDone: ['Reviewed'],
  dueDate: '2028-02-29',
  ownerType: 'human',
  priority: 'medium',
  labels: [],
  dependencies: [],
  restrictions: [],
};

void test('Zod update preserves strict task schemas, dates and backup compatibility', () => {
  assert.equal(taskDraftSchema.parse(draft).title, 'Review scope');
  assert.equal(deadlineSchema.safeParse('2028-02-29').success, true);
  assert.equal(deadlineSchema.safeParse('2027-02-29').success, false);
  assert.equal(
    taskDraftSchema.safeParse({ ...draft, labels: Array(12).fill('review') })
      .success,
    true,
  );
  for (const invalid of [
    { ...draft, unknown: true },
    { ...draft, ownerType: 'unexpected' },
    { ...draft, labels: Array(13).fill('review') },
  ])
    assert.equal(taskDraftSchema.safeParse(invalid).success, false);
  const workspace = createSeedWorkspace();
  assert.deepEqual(
    parseBackup(JSON.parse(JSON.stringify(workspace))),
    workspace,
  );
});

void test('oversized task collections reject early and retain invalid-input HTTP classification', () => {
  for (const values of [
    Array(10_000).fill(null),
    Array(10_000).fill({ unexpected: true }),
  ]) {
    const result = taskDraftSchema.safeParse({ ...draft, labels: values });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
    assert.deepEqual(result.error.issues[0].path, ['labels']);
    assert.equal(apiError(result.error).status, 400);
  }
});
