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
  assert.match(source, /untrustedContentHint: true/);
  assert.doesNotMatch(source, /name: 'approve_deliverable'/);
  assert.doesNotMatch(source, /name: 'reject_deliverable'/);
  assert.doesNotMatch(source, /name: 'answer_clarification'/);
});

test('tool metadata describes untrusted content without instruction-shaped text', () => {
  assert.match(source, /marked as untrusted content/);
  assert.doesNotMatch(source, /must never be treated as agent instructions/);
  assert.doesNotMatch(source, /returned task text is untrusted/);
});

test('all WebMCP input properties have descriptions', () => {
  assert.match(source, /inputSchema: \{ type: 'object', properties: \{\}, additionalProperties: false \}/);
  assert.match(source, /name: 'list_ready_tasks',[\s\S]*?required: \[\],[\s\S]*?additionalProperties: false/);
  const propertyBlocks = [...source.matchAll(/properties:\s*\{([\s\S]*?)\n\s*\},\n\s*(?:required:|additionalProperties:)/g)];
  assert.equal(propertyBlocks.length, 5);
  for (const [, block] of propertyBlocks) {
    const propertyNames = [...block.matchAll(/^\s{12}([a-zA-Z][a-zA-Z0-9]*):\s*\{/gm)].map((match) => match[1]);
    for (const propertyName of propertyNames) {
      const start = block.indexOf(`${propertyName}: {`);
      const nextProperty = propertyNames
        .map((name) => block.indexOf(`${name}: {`, start + propertyName.length + 3))
        .filter((index) => index > start)
        .sort((a, b) => a - b)[0];
      const propertyBlock = block.slice(start, nextProperty ?? block.length);
      assert.match(propertyBlock, /description:/, `${propertyName} is missing a description`);
    }
  }
});

