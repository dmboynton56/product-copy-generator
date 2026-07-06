"use client";

import type { ToolEvent } from "@/agent/types";

type RunConsoleProps = {
  events: ToolEvent[];
  status: string;
};

function statusClass(status: string) {
  switch (status) {
    case "running":
      return "status-running";
    case "completed":
      return "status-completed";
    case "failed":
      return "status-failed";
    default:
      return "status-queued";
  }
}

export function RunConsole({ events, status }: RunConsoleProps) {
  return (
    <section className="panel flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Run Console</h2>
          <p className="muted text-sm">Live tool calls and statuses</p>
        </div>
        <span className={`status-pill ${statusClass(status)}`}>{status}</span>
      </div>

      <div className="min-h-[420px] flex-1 space-y-3 overflow-auto">
        {events.length === 0 ? (
          <p className="muted text-sm">Waiting for the agent to start calling tools.</p>
        ) : (
          events.map((event) => (
            <article key={event.id} className="rounded-lg border border-stone-200 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <strong className="text-sm">{event.toolName}</strong>
                <span className={`status-pill ${statusClass(event.status)}`}>{event.status}</span>
              </div>
              <p className="muted text-xs">#{event.sequence}</p>
              {event.error ? (
                <p className="mt-2 text-sm text-red-700">{event.error}</p>
              ) : null}
              {event.output ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-stone-50 p-2 text-xs whitespace-pre-wrap">
                  {JSON.stringify(event.output, null, 2)}
                </pre>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
