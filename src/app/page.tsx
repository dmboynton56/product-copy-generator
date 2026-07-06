"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PRESET_TASKS } from "@/shared/presets";
import type { RunSummary, ToolEvent } from "@/shared/automation-types";
import { CopyReviewPanel } from "@/ui/CopyReviewPanel";
import { ProductTable } from "@/ui/ProductTable";
import { ReportViewer } from "@/ui/ReportViewer";
import { RunConsole } from "@/ui/RunConsole";
import { RunHistory } from "@/ui/RunHistory";

type RunPayload = {
  id: string;
  task: string;
  status: string;
  finalSummary?: string;
  error?: string;
  events: ToolEvent[];
  products: Record<string, unknown>[];
  generatedItems: Record<string, unknown>[];
  validation?: {
    issueCount?: number;
    issues?: Array<{ productId: string; productName: string; issue: string }>;
  };
  review?: {
    summary?: string;
    flaggedItems?: Array<{
      productId: string;
      issueType: string;
      severity: string;
      notes: string;
      suggestedFix: string;
    }>;
  };
  report?: {
    markdown?: string;
    markdownPath?: string;
    jsonPath?: string;
  };
};

function isTerminal(status: string): boolean {
  return status === "completed" || status === "failed";
}

export default function HomePage() {
  const [task, setTask] = useState(PRESET_TASKS[0]?.task ?? "");
  const [run, setRun] = useState<RunPayload | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const status = run?.status ?? "queued";

  const refreshHistory = useCallback(async () => {
    const response = await fetch("/api/runs");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { runs?: RunSummary[] };
    setHistory(payload.runs ?? []);
  }, []);

  const refreshRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/runs/${runId}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as RunPayload;
  }, []);

  useEffect(() => {
    void refreshHistory().then(async () => {
      const response = await fetch("/api/runs");
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { runs?: RunSummary[] };
      const latest = payload.runs?.[0];
      if (latest) {
        const loaded = await refreshRun(latest.id);
        if (loaded) {
          setRun(loaded);
        }
      }
    });
  }, [refreshHistory, refreshRun]);

  useEffect(() => {
    if (!run?.id || isTerminal(run.status)) {
      if (run?.id && isTerminal(run.status)) {
        void refreshHistory();
      }
      return;
    }

    const source = new EventSource(`/api/runs/${run.id}/events`);

    source.addEventListener("run", (event) => {
      setRun(JSON.parse(event.data) as RunPayload);
      setStreamError(null);
    });

    source.addEventListener("event", (event) => {
      const toolEvent = JSON.parse(event.data) as ToolEvent;
      setRun((current) =>
        current
          ? {
              ...current,
              events: [...current.events.filter((item) => item.id !== toolEvent.id), toolEvent].sort(
                (a, b) => a.sequence - b.sequence,
              ),
            }
          : current,
      );
    });

    source.addEventListener("done", (event) => {
      const payload = JSON.parse(event.data) as { status?: string; error?: string };
      void refreshRun(run.id).then((latest) => {
        if (latest) {
          setRun(latest);
        } else if (payload.error) {
          setRun((current) => (current ? { ...current, status: "failed", error: payload.error } : current));
        }
        void refreshHistory();
      });
      source.close();
    });

    source.onerror = async () => {
      source.close();
      const latest = await refreshRun(run.id);
      if (latest) {
        setRun(latest);
        if (isTerminal(latest.status)) {
          void refreshHistory();
          return;
        }
      }
      setStreamError("Live stream disconnected. Polling run status instead.");
    };

    return () => source.close();
  }, [run?.id, refreshHistory, refreshRun]);

  useEffect(() => {
    if (!run?.id || isTerminal(run.status)) {
      return;
    }

    const interval = setInterval(() => {
      void refreshRun(run.id).then((latest) => {
        if (latest) {
          setRun(latest);
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [run?.id, run?.status, refreshRun]);

  const consoleEvents = useMemo(() => run?.events ?? [], [run?.events]);
  const isFeedbackRun = useMemo(() => {
    const signal = `${run?.task ?? task} ${consoleEvents.map((event) => event.toolName).join(" ")}`.toLowerCase();
    return (
      signal.includes("feedback") ||
      signal.includes("buyer") ||
      signal.includes("customer intelligence") ||
      signal.includes("load_feedback_dataset") ||
      signal.includes("analyze_buyer_feedback")
    );
  }, [consoleEvents, run?.task, task]);

  async function loadRun(runId: string) {
    setStreamError(null);
    const loaded = await refreshRun(runId);
    if (loaded) {
      setRun(loaded);
      setTask(loaded.task);
    }
  }

  async function startRun(selectedTask: string) {
    setIsSubmitting(true);
    setStreamError(null);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: selectedTask }),
      });

      const payload = (await response.json()) as {
        runId?: string;
        run?: RunPayload;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to start automation run.");
      }

      if (payload.run) {
        setRun(payload.run);
      } else if (payload.runId) {
        const latest = await refreshRun(payload.runId);
        if (latest) {
          setRun(latest);
        }
      }

      setTask(selectedTask);
      void refreshHistory();
    } catch (error) {
      setStreamError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="space-y-2">
          <p className="muted text-sm uppercase tracking-[0.2em]">Retail AI Automation Suite</p>
          <h1 className="text-3xl font-semibold">KHAITE retail automation demo</h1>
          <p className="muted max-w-3xl text-sm">
            Enter a plain-English task, watch Claude choose tools, and inspect catalog data,
            buyer-feedback analysis, generated copy, validation, and final reports.
          </p>
        </header>

        {run?.status === "failed" && run.error ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Run failed:</strong> {run.error}
            {run.error.toLowerCase().includes("billing") || run.error.toLowerCase().includes("credit") ? (
              <p className="mt-2">
                Add credits at{" "}
                <a className="underline" href="https://console.anthropic.com/settings/billing">
                  console.anthropic.com/settings/billing
                </a>{" "}
                and try again. Scraping still works without credits:{" "}
                <code>USE_HTML_CACHE=1 npm run scrape:khaite -- --limit 2</code>
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="panel space-y-4 p-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Automation task</span>
            <textarea
              className="min-h-28 w-full rounded-lg border border-stone-300 bg-white p-3 text-sm"
              value={task}
              onChange={(event) => setTask(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {PRESET_TASKS.map((preset) => (
              <button
                key={preset.label}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
                onClick={() => {
                  setTask(preset.task);
                  void startRun(preset.task);
                }}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={isSubmitting || !task.trim()}
              onClick={() => void startRun(task)}
              type="button"
            >
              {isSubmitting ? "Starting..." : "Run automation"}
            </button>
            {streamError ? <p className="text-sm text-red-700">{streamError}</p> : null}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            <RunHistory activeRunId={run?.id} runs={history} onSelect={(runId) => void loadRun(runId)} />
            <RunConsole events={consoleEvents} status={status} />
          </div>
          <div className="space-y-6">
            <ProductTable
              products={run?.products ?? []}
              title={isFeedbackRun ? "Feedback Inputs" : "Extracted Products"}
              emptyText={isFeedbackRun ? "No feedback dataset loaded yet." : "No products extracted yet."}
            />
            {!isFeedbackRun ? (
              <CopyReviewPanel
                generatedItems={run?.generatedItems ?? []}
                validation={run?.validation}
                review={run?.review}
              />
            ) : null}
            <ReportViewer
              report={run?.report}
              finalSummary={run?.finalSummary}
              status={status}
              error={run?.error}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
