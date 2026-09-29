/* oxlint-disable typescript/no-floating-promises -- node:test registers promise-returning test handles at module scope. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseWorkspaceAction, ValidationError } from '../lib/validation.ts';

test('mutation payloads accept only declared fields', () => {
  assert.throws(
    () =>
      parseWorkspaceAction({
        type: 'claim_task',
        agentId: 'builder-agent',
        taskId: 'RP-105',
        hidden: true,
      }),
    ValidationError,
  );
});

test('progress payloads enforce numeric bounds', () => {
  assert.throws(
    () =>
      parseWorkspaceAction({
        type: 'update_task_progress',
        agentId: 'builder-agent',
        taskId: 'RP-103',
        note: 'Progress note',
        completionPercentage: 101,
        timeSpentMinutes: 15,
      }),
    ValidationError,
  );
});

test('a valid deliverable payload is normalized without gaining authority', () => {
  const action = parseWorkspaceAction({
    type: 'submit_deliverable',
    agentId: 'research-agent',
    taskId: 'RP-104',
    summary: '  Verified the implementation.  ',
    content: '  Evidence-backed implementation review.  ',
    evidence: [' https://learn.chatgpt.com/docs/webmcp '],
    knownLimitations: [' Browser support varies. '],
    recommendedNextAction: ' Human approval. ',
  });

  assert.equal(action.type, 'submit_deliverable');
  if (action.type === 'submit_deliverable') {
    assert.equal(action.summary, 'Verified the implementation.');
    assert.equal(action.evidence[0], 'https://learn.chatgpt.com/docs/webmcp');
  }
});
