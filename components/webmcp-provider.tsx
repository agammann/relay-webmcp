'use client';
import { useEffect, useState } from 'react';
import { createTools } from '@/lib/tools';
export function WebMcpProvider({ ready }: { ready: boolean }) {
  const [message, setMessage] = useState(
    'Loading workspace before connecting tools…',
  );
  useEffect(() => {
    if (!ready) return;
    const context = document.modelContext ?? navigator.modelContext;
    let active = true;
    const update = (text: string) => {
      if (active) setMessage(text);
    };
    if (!context) {
      queueMicrotask(() =>
        update('WebMCP unavailable here. All task controls work manually.'),
      );
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        for (const tool of createTools(update)) {
          if (!active) return;
          await context.registerTool(tool, { signal: controller.signal });
        }
        update('6 WebMCP tools connected');
      } catch {
        controller.abort();
        update(
          'WebMCP connection failed. Reload to retry, or use the task controls.',
        );
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [ready]);
  return (
    <aside className="connection" aria-label="WebMCP connection">
      <span className="connection-dot" />
      {message}
    </aside>
  );
}
