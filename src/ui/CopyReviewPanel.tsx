"use client";

type CopyReviewPanelProps = {
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
};

export function CopyReviewPanel({ generatedItems, validation, review }: CopyReviewPanelProps) {
  return (
    <section className="panel space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Generated Copy</h2>
        <p className="muted text-sm">Structured PDP output, validation, and review flags</p>
      </div>

      {generatedItems.length === 0 ? (
        <p className="muted text-sm">No generated copy yet.</p>
      ) : (
        <div className="space-y-3">
          {generatedItems.map((item) => (
            <article key={String(item.productId ?? item.name)} className="rounded-lg border border-stone-200 p-3">
              <h3 className="font-medium">{String(item.productName ?? item.productId ?? "Item")}</h3>
              <p className="mt-2 text-sm">
                {String(
                  (item.generated as Record<string, string> | undefined)?.description ??
                    item.description ??
                    "",
                )}
              </p>
            </article>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-medium">Validation</h3>
        <p className="muted text-sm">
          {validation?.issueCount ?? 0} issue(s) found
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {(validation?.issues ?? []).slice(0, 8).map((issue) => (
            <li key={`${issue.productId}-${issue.issue}`}>
              <strong>{issue.productName}:</strong> {issue.issue}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-medium">AI Review</h3>
        <p className="mt-1 text-sm">{review?.summary ?? "Review has not run yet."}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {(review?.flaggedItems ?? []).slice(0, 8).map((flag) => (
            <li key={`${flag.productId}-${flag.notes}`}>
              <strong>{flag.productId}</strong> ({flag.severity}): {flag.notes}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
