/* oxlint-disable typescript/no-floating-promises -- node:test registers promise-returning test handles at module scope. */
import assert from 'node:assert/strict';
import test from 'node:test';
import nextConfig from '../next.config.ts';
import { GET } from '../app/favicon.ico/route.ts';

test('local favicon stays on its origin without a CSP scheme upgrade', async () => {
  const response = GET();
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/favicon.svg');
  const routes = await nextConfig.headers!();
  for (const route of routes) {
    const policy = route.headers.find(
      (header) => header.key === 'Content-Security-Policy',
    )?.value;
    assert.match(policy ?? '', /img-src 'self' data: blob:/);
    assert.doesNotMatch(policy ?? '', /upgrade-insecure-requests/);
    assert.ok(
      route.headers.some(
        (header) => header.key === 'Strict-Transport-Security',
      ),
    );
  }
});
