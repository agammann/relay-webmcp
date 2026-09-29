/* oxlint-disable typescript/no-floating-promises -- node:test registers promise-returning test handles at module scope. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nextConfig = readFileSync(
  new URL('../next.config.ts', import.meta.url),
  'utf8',
);
const robots = readFileSync(
  new URL('../public/robots.txt', import.meta.url),
  'utf8',
);
const sitemap = readFileSync(
  new URL('../public/sitemap.xml', import.meta.url),
  'utf8',
);
const llms = readFileSync(
  new URL('../public/llms.txt', import.meta.url),
  'utf8',
);
const initialMigration = readFileSync(
  new URL('../drizzle/0000_relay_workspace.sql', import.meta.url),
  'utf8',
);

test('the root and nested routes receive the production security headers', () => {
  assert.match(nextConfig, /source: '\/'/);
  assert.match(nextConfig, /source: '\/:path\*'/);
  for (const header of [
    'Content-Security-Policy',
    'Permissions-Policy',
    'Referrer-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
  ]) {
    assert.match(nextConfig, new RegExp(header));
  }
});

test('crawler files consistently describe the Relay release', () => {
  assert.match(robots, /Allow: \//);
  assert.match(robots, /https:\/\/relay\.alx21\.chatgpt\.site\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/relay\.alx21\.chatgpt\.site\/<\/loc>/);
  assert.match(llms, /^# Relay$/m);
  assert.match(llms, /https:\/\/github\.com\/agammann\/relay-webmcp/);
  assert.doesNotMatch(
    `${robots}\n${sitemap}\n${llms}`,
    /RelayPlan|relayplan-webmcp/,
  );
});

test('the initial migration is safe when a workspace was created by the runtime bootstrap', () => {
  assert.match(initialMigration, /CREATE TABLE IF NOT EXISTS `workspaces`/);
  assert.match(
    initialMigration,
    /CREATE INDEX IF NOT EXISTS `idx_workspaces_updated_at`/,
  );
});
