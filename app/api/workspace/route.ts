import { apiError, parseWorkspaceAction } from '@/lib/validation';

export async function GET() {
  try {
    const { getWorkspace } = await import('@/lib/database');
    const workspace = await getWorkspace();
    return Response.json({ success: true, workspace });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { mutateWorkspace } = await import('@/lib/database');
    const action = parseWorkspaceAction(await request.json());
    const result = await mutateWorkspace(action);
    return Response.json({
      success: true,
      action: result.action,
      projectId: result.workspace.id,
      taskId: result.taskId,
      agentId: result.agentId,
      workspaceVersion: result.workspace.version,
      previousStatus: result.previousStatus,
      currentStatus: result.currentStatus,
      changedEntityIds: result.changedEntityIds,
      warnings: result.warnings,
      summary: result.summary,
      updatedAt: result.workspace.updatedAt,
      workspace: result.workspace,
    });
  } catch (error) {
    return apiError(error);
  }
}
