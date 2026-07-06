"use client";

import type { RunSummary } from "@/shared/automation-types";

type RunHistoryProps = {
  runs: RunSummary[];
  activeRunId?: string;
  onSelect: (runId: string) => void;
};

function statusClass(status: RunSummary["status"]) {
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

function formatWhen(value: string): string {
  return new Date(value).toLocaleString();
}

export function RunHistory({ runs, activeRunId, onSelect }: RunHistoryProps) {
  return (
    <section className="panel p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Run History</h2>
        <p className="muted text-sm">Saved runs persist across dev server restarts.</p>
      </div>

      {runs.length === 0 ? (
        <p className="muted text-sm">No saved runs yet.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-auto">
          {runs.map((item) => (
            <button
              key={item.id}
              className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                activeRunId === item.id
                  ? "border-stone-900 bg-stone-50"
                  : "border-stone-200 hover:bg-stone-50"
              }`}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={`status-pill ${statusClass(item.status)}`}>{item.status}</span>
                <span className="muted text-xs">{formatWhen(item.startedAt)}</span>
              </div>
              <p className="line-clamp-2">{item.task}</p>
              <p className="muted mt-1 text-xs">
                {item.productCount} products · {item.eventCount} tool events
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
