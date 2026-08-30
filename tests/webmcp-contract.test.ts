/* oxlint-disable typescript/no-floating-promises -- node:test registers promise-returning test handles at module scope. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../components/webmcp-provider.tsx', import.meta.url), 'utf8');

test('the page registers the six documented WebMCP tools', () => {
  const names = [
    'get_workspace_context',
    'list_ready_tasks',
    'claim_task',
    'update_task_progress',
    'submit_deliverable',
    'request_human_input',
  ];
  for (const name of names) assert.match(source, new RegExp(`name: '${name}'`));
  assert.equal((source.match(/context\.registerTool/g) ?? []).length, 1);
});

test('tool schemas are closed and human approval is not agent-exposed', () => {
  assert.match(source, /additionalProperties: false/);
  assert.match(source, /readOnlyHint: true/);
  assert.doesNotMatch(source, /name: 'approve_deliverable'/);
  assert.doesNotMatch(source, /name: 'reject_deliverable'/);
  assert.doesNotMatch(source, /name: 'answer_clarification'/);
});
