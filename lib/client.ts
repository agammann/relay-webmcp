'use client';
import { flushSync } from 'react-dom';
import type { ActionResult, Workspace, WorkspaceAction } from './domain';
import { parseWorkspaceAction } from './validation';
type State = {
  workspace: Workspace | null;
  busy: boolean;
  error: string | null;
  message: string;
};
const initial: State = {
  workspace: null,
  busy: false,
  error: null,
  message: 'Loading saved workspace…',
};
let state = initial;
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const snapshot = () => state;
export const serverSnapshot = () => initial;
function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  flushSync(() => {
    for (const listener of listeners) listener();
  });
}
async function request(init?: RequestInit) {
  const response = await fetch('/api/workspace', {
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json' },
  });
  const data = (await response.json()) as ActionResult & {
    success: true;
    error?: string;
  };
  if (!response.ok || !data.success)
    throw new Error(data.error ?? 'Relay could not save this change.');
  return data;
}
let read: Promise<Workspace> | null = null;
export function loadWorkspace(signal?: AbortSignal): Promise<Workspace> {
  if (signal?.aborted)
    return Promise.reject(new Error('Tool call cancelled before reading.'));
  read ??= request()
    .then((data) => {
      if (
        !state.workspace ||
        data.workspace.id !== state.workspace.id ||
        data.workspace.version >= state.workspace.version
      )
        update({
          workspace: data.workspace,
          error: null,
          message: 'Workspace loaded.',
        });
      return state.workspace!;
    })
    .catch((error) => {
      update({
        error:
          error instanceof Error
            ? error.message
            : 'Cannot reach the workspace server.',
        message: 'Workspace could not be loaded. Retry when connected.',
      });
      throw error;
    })
    .finally(() => {
      read = null;
    });
  return read;
}
export async function mutateWorkspace(
  input: WorkspaceAction,
  signal?: AbortSignal,
): Promise<ActionResult & { success: true }> {
  if (signal?.aborted) throw new Error('Tool call cancelled before saving.');
  if (state.busy)
    throw new Error(
      'Another change is being saved. Wait for it to finish, then retry.',
    );
  if (!state.workspace)
    throw new Error('Workspace is not loaded. Refresh before making changes.');
  const action = parseWorkspaceAction(input);
  update({ busy: true, error: null });
  try {
    // Once submitted, wait for confirmation instead of misreporting a committed write as cancelled.
    const data = await request({
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: state.workspace!.version,
        action,
      }),
    });
    update({ workspace: data.workspace, message: data.summary, error: null });
    return data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Save could not be confirmed.';
    update({
      error: `${message} Refresh before retrying; an interrupted response can leave a save unconfirmed.`,
    });
    throw error;
  } finally {
    update({ busy: false });
  }
}
