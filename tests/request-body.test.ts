/* oxlint-disable typescript/no-floating-promises -- node:test handles registered promises. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedBody, ValidationError } from '../lib/validation.ts';

test('request reader counts streamed UTF-8 bytes across chunks', async () => {
  const fox = new TextEncoder().encode('🦊');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(fox.subarray(0, 2));
      controller.enqueue(fox.subarray(2));
      controller.close();
    },
  });
  const request = new Request('http://127.0.0.1/', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  assert.equal(await readBoundedBody(request, 4), '🦊');
});

test('request reader rejects oversized open stream without waiting for EOF', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(5));
    },
  });
  const request = new Request('http://127.0.0.1/', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  await assert.rejects(readBoundedBody(request, 4), ValidationError);
});
