import { env } from 'cloudflare:workers';
import type { ActionResult, Workspace, WorkspaceAction } from './domain';
import { applyWorkspaceAction, RuleError } from './rules';
import { createWorkspace } from './project';
let ready: Promise<unknown> | undefined;
async function database() {
  if (!env.DB) throw new Error('Database binding unavailable.');
  ready ??= env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)',
  )
    .run()
    .catch((error) => {
      ready = undefined;
      throw error;
    });
  await ready;
  return env.DB;
}
export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const db = await database();
  let row = await db
    .prepare('SELECT data FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first<{ data: string }>();
  if (!row) {
    const workspace = createWorkspace(workspaceId);
    await db
      .prepare(
        'INSERT OR IGNORE INTO workspaces (id, version, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        workspaceId,
        workspace.version,
        JSON.stringify(workspace),
        workspace.createdAt,
        workspace.updatedAt,
      )
      .run();
    row = await db
      .prepare('SELECT data FROM workspaces WHERE id = ?')
      .bind(workspaceId)
      .first<{ data: string }>();
  }
  if (!row) throw new Error('Workspace unavailable.');
  return JSON.parse(row.data) as Workspace;
}
export async function mutateWorkspace(
  workspaceId: string,
  expectedVersion: number,
  action: WorkspaceAction,
): Promise<ActionResult> {
  const db = await database();
  const current = await getWorkspace(workspaceId);
  if (current.version !== expectedVersion)
    throw new RuleError(
      'This workspace changed in another tab. Refresh, review the latest state, and retry.',
    );
  const result = applyWorkspaceAction(current, action);
  const json = JSON.stringify(result.workspace);
  if (new TextEncoder().encode(json).length > 900000)
    throw new RuleError(
      'Workspace storage limit reached (900 KB). Export a backup and start a new project.',
    );
  const write = await db
    .prepare(
      'UPDATE workspaces SET version = ?, data = ?, updated_at = ? WHERE id = ? AND version = ?',
    )
    .bind(
      result.workspace.version,
      json,
      result.workspace.updatedAt,
      workspaceId,
      current.version,
    )
    .run();
  if (!write.meta.changes)
    throw new RuleError(
      'Another action changed this workspace. Refresh, review the latest state, and retry.',
    );
  return result;
}
