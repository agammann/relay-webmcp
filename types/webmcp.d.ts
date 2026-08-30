type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, context?: { signal?: AbortSignal }) => Promise<unknown>;
};

type WebModelContext = {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void>;
  getTools?(): Promise<WebMcpTool[]>;
};

interface Document {
  modelContext?: WebModelContext;
}

interface Navigator {
  modelContext?: WebModelContext;
}

interface Window {
  __relayPlanWebMcp?: { controller: AbortController; names: string[] };
  __relayPlanPreviewWorkspace?: import('@/lib/domain').Workspace;
}
