import {
  apiError,
  parseWorkspaceAction,
  ValidationError,
} from '@/lib/validation';
import { readSession } from '@/lib/session';
export async function GET(request: Request) {
  try {
    const session = (await readSession(request, true))!;
    const { getWorkspace } = await import('@/lib/database');
    const workspace = await getWorkspace(session.id);
    return Response.json(
      { success: true, workspace },
      {
        headers: { 'cache-control': 'no-store', 'set-cookie': session.cookie },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new ValidationError('Send JSON.');
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new ValidationError('Open Relay directly to make changes.');
    const session = await readSession(request, false);
    if (!session)
      throw new ValidationError(
        'Workspace session missing. Enable cookies and reload Relay.',
      );
    if (Number(request.headers.get('content-length')) > 1000000)
      throw new ValidationError('Backup is too large (maximum 900 KB).');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1000000)
      throw new ValidationError('Request is too large.');
    const input = JSON.parse(raw);
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) => !['action', 'expectedVersion'].includes(key),
      ) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    )
      throw new ValidationError(
        'Expected an action and the current workspace version.',
      );
    const action = parseWorkspaceAction(input.action);
    const { mutateWorkspace } = await import('@/lib/database');
    const result = await mutateWorkspace(
      session.id,
      input.expectedVersion,
      action,
    );
    return Response.json(
      {
        success: true,
        ...result,
        projectId: result.workspace.id,
        workspaceVersion: result.workspace.version,
        updatedAt: result.workspace.updatedAt,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
