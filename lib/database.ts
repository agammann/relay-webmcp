import { env } from 'cloudflare:workers';

import type { ActionResult, Workspace, WorkspaceAction } from './domain';
import { applyWorkspaceAction } from './rules';
import { createSeedWorkspace } from './seed-data';

const workspaceId = 'relayplan-demo';
const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at DESC)`,
];

const getD1 = () => {
  if (!env.DB) throw new Error('RelayPlan database is unavailable.');
  return env.DB;
};

let ready: Promise<void> | null = null;

export async function ensureDatabase() {
  if (ready) return ready;
  ready = (async () => {
    const db = getD1();
    await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
    const existing = await db.prepare('SELECT id FROM workspaces WHERE id = ?').bind(workspaceId).first<{ id: string }>();
    if (!existing) {
      const seed = createSeedWorkspace();
      await db
        .prepare('INSERT INTO workspaces (id, version, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(seed.id, seed.version, JSON.stringify(seed), seed.createdAt, seed.updatedAt)
        .run();
      await db.prepare('PRAGMA optimize').run();
    }
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export async function getWorkspace(): Promise<Workspace> {
  await ensureDatabase();
  const row = await getD1()
    .prepare('SELECT data FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first<{ data: string }>();
  if (!row) throw new Error('RelayPlan workspace was not found.');
  return JSON.parse(row.data) as Workspace;
}

export async function mutateWorkspace(action: WorkspaceAction): Promise<ActionResult> {
  await ensureDatabase();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await getWorkspace();
    const result = applyWorkspaceAction(current, action);
    const write = await getD1()
      .prepare('UPDATE workspaces SET version = ?, data = ?, updated_at = ? WHERE id = ? AND version = ?')
      .bind(
        result.workspace.version,
        JSON.stringify(result.workspace),
        result.workspace.updatedAt,
        workspaceId,
        current.version,
      )
      .run();
    if (write.meta.changes) return result;
  }
  throw new Error('RelayPlan changed while the action was being applied. Please retry.');
}
