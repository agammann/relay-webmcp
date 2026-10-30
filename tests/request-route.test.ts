/* oxlint-disable typescript/no-floating-promises -- node:test handles registered promises. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(
        new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const { POST } = await import('../app/api/workspace/route.ts');
const url = 'http://127.0.0.1/api/workspace';
const headers = {
  'content-type': 'application/json',
  origin: 'http://127.0.0.1',
  cookie: `relay_workspace=${'a'.repeat(64)}`,
};

test('route rejects an oversized open stream before EOF', { timeout: 2000 }, async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1_000_001));
    },
  });
  const request = new Request(url, {
    method: 'POST',
    headers,
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  const response = await POST(request);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Request is too large.',
  });
});

test('stream cap applies when declared length is smaller', { timeout: 2000 }, async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1_000_001));
    },
  });
  const request = new Request(url, {
    method: 'POST',
    headers: { ...headers, 'content-length': '1' },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  const response = await POST(request);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Request is too large.',
  });
});

test('route validates a finite request after reading it', async () => {
  const response = await POST(
    new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: { type: 'unsupported' },
        expectedVersion: 1,
      }),
    }),
  );
  assert.equal(response.status, 400);
  const result = (await response.json()) as { error: string };
  assert.match(result.error, /Unsupported action type/);
});
