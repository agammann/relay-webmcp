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
    let controller: AbortController | null = null;
    const register = () => {
      if (!active) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const notify = (text: string) => {
        if (!current.signal.aborted) update(text);
      };
      notify('Connecting WebMCP tools…');
      void (async () => {
        try {
          for (const tool of createTools(notify)) {
            if (!active || current.signal.aborted) return;
            await context.registerTool(tool, { signal: current.signal });
          }
          notify('6 WebMCP tools connected');
        } catch {
          if (current.signal.aborted) return;
          current.abort();
          update(
            'WebMCP connection failed. Reload to retry, or use the task controls.',
          );
        }
      })();
    };
    const hide = () => {
      controller?.abort();
      update('Page hidden; WebMCP tools disconnected.');
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) register();
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    register();
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [ready]);
  return (
    <aside className="connection" aria-label="WebMCP connection">
      <span className="connection-dot" />
      {message}
    </aside>
  );
}
