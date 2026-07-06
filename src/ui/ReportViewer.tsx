"use client";

type ReportViewerProps = {
  report?: {
    markdown?: string;
    markdownPath?: string;
    jsonPath?: string;
  };
  finalSummary?: string;
  status: string;
  error?: string;
};

export function ReportViewer({ report, finalSummary, status, error }: ReportViewerProps) {
  const markdown = report?.markdown ?? "";

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Final Report</h2>
          <p className="muted text-sm">Automation summary and exportable report</p>
        </div>
        {markdown ? (
          <button
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
            onClick={() => {
              const blob = new Blob([markdown], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "catalog-automation-report.md";
              anchor.click();
              URL.revokeObjectURL(url);
            }}
            type="button"
          >
            Export Markdown
          </button>
        ) : null}
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {finalSummary ? <p className="mb-3 text-sm">{finalSummary}</p> : null}

      {markdown ? (
        <pre className="max-h-80 overflow-auto rounded bg-stone-50 p-3 text-xs whitespace-pre-wrap">
          {markdown}
        </pre>
      ) : (
        <p className="muted text-sm">
          {status === "running"
            ? "Report will appear when the agent finishes."
            : "No report generated yet."}
        </p>
      )}
    </section>
  );
}
