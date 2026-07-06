import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PATHS } from "@/lib/paths";

const WriteReportInputSchema = z.object({
  runId: z.string(),
  task: z.string(),
  collectionUrl: z.string().optional(),
  products: z.array(z.record(z.string(), z.unknown())),
  generatedItems: z.array(z.record(z.string(), z.unknown())),
  validation: z.object({
    issueCount: z.number(),
    issues: z.array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        issue: z.string(),
      }),
    ),
    reportMarkdown: z.string(),
  }),
  review: z.object({
    summary: z.string(),
    flaggedItems: z.array(
      z.object({
        productId: z.string(),
        issueType: z.string(),
        severity: z.string(),
        notes: z.string(),
        suggestedFix: z.string(),
      }),
    ),
  }),
  finalSummary: z.string().optional(),
});

function buildMarkdownReport(input: z.infer<typeof WriteReportInputSchema>): string {
  const lines = [
    "# Catalog Copy Automation Report",
    "",
    "## Run Summary",
    "",
    `- Run ID: ${input.runId}`,
    `- Task: ${input.task}`,
    `- Collection URL: ${input.collectionUrl ?? "n/a"}`,
    `- Products extracted: ${input.products.length}`,
    `- Generated items: ${input.generatedItems.length}`,
    `- Validation issues: ${input.validation.issueCount}`,
    `- AI review flags: ${input.review.flaggedItems.length}`,
    "",
    input.finalSummary ? `Final summary: ${input.finalSummary}` : "",
    "",
    "## Source Products",
    "",
  ];

  for (const product of input.products) {
    lines.push(`- ${String(product.name ?? "Unknown")} (${String(product.url ?? product.sourceUrl ?? "no url")})`);
  }

  lines.push("", "## Generated Copy", "");
  for (const item of input.generatedItems) {
    lines.push(`### ${String(item.productName ?? item.productId ?? "Item")}`);
    lines.push(`- Description: ${String((item.generated as Record<string, string> | undefined)?.description ?? item.description ?? "")}`);
    lines.push("");
  }

  lines.push("## Validation Issues", "", input.validation.reportMarkdown, "", "## AI Review", "", input.review.summary, "");

  if (input.review.flaggedItems.length === 0) {
    lines.push("No AI review issues flagged.");
  } else {
    for (const flag of input.review.flaggedItems) {
      lines.push(`- ${flag.productId}: ${flag.notes} (${flag.severity})`);
    }
  }

  lines.push("", "## Recommended Next Actions", "", "- Resolve high-severity validation or review flags before publishing.", "- Keep source URLs attached to every generated item.", "");

  return `${lines.filter(Boolean).join("\n")}\n`;
}

export async function writeReport(input: unknown) {
  const parsed = WriteReportInputSchema.parse(input);
  const runDir = path.join(PATHS.automationRuns, parsed.runId);
  await fs.mkdir(runDir, { recursive: true });

  const markdown = buildMarkdownReport(parsed);
  const jsonReport = {
    ...parsed,
    markdown,
    writtenAt: new Date().toISOString(),
  };

  const markdownPath = path.join(runDir, "report.md");
  const jsonPath = path.join(runDir, "report.json");

  await fs.writeFile(markdownPath, markdown, "utf8");
  await fs.writeFile(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, "utf8");

  return {
    runId: parsed.runId,
    markdownPath,
    jsonPath,
    markdown,
  };
}

export type WriteReportResult = Awaited<ReturnType<typeof writeReport>>;
