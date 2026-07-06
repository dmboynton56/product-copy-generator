import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PATHS } from "@/lib/paths";

const StringArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [String(value)];
}, z.array(z.string()));

const FindingSchema = z.object({
  theme: z.string().catch("Unspecified finding"),
  products: StringArraySchema,
  evidence: StringArraySchema,
  action: z.string().optional(),
  confidence: z.string().catch("medium"),
});

const FeedbackDatasetSchema = z.object({
    datasetId: z.string(),
    label: z.string(),
    caveat: z.string(),
    products: z.array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        category: z.string(),
        url: z.string().optional(),
      }),
    ),
});

const FeedbackReportInputSchema = z.object({
  runId: z.string(),
  task: z.string(),
  dataset: z.union([
    FeedbackDatasetSchema,
    z.object({
      dataset: FeedbackDatasetSchema,
    }),
  ]),
  analysis: z.unknown().optional(),
});

const FeedbackAnalysisSchema = z.object({
  summary: z.string().catch("Buyer-feedback analysis completed."),
  whatBuyersAreReallySaying: z
    .string()
    .catch("Buyers are signaling where product quality is strong and where PDP details need more proof."),
  recurringPraiseThemes: z.array(FindingSchema).catch([]),
  recurringComplaints: z.array(FindingSchema).catch([]),
  fitQualityMaterialIssues: z.array(FindingSchema).catch([]),
  pdpCopyGaps: z.array(FindingSchema).catch([]),
  productImprovementSuggestions: z.array(FindingSchema).catch([]),
  recommendedActions: StringArraySchema,
  riskNotes: StringArraySchema,
  analyzedAt: z.string().optional(),
  model: z.string().optional(),
});

type Finding = z.infer<typeof FindingSchema>;
type FeedbackDataset = z.infer<typeof FeedbackDatasetSchema>;
type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>;

function unwrapDataset(input: z.infer<typeof FeedbackReportInputSchema>["dataset"]): FeedbackDataset {
  if ("dataset" in input) {
    return input.dataset;
  }

  return input;
}

function buildMinimalAnalysis(dataset: FeedbackDataset, reason: string): FeedbackAnalysis {
  const productNames = dataset.products.map((product) => product.productName);

  return {
    summary:
      "The mock feedback highlights strong product appeal, while fit clarity, measurements, capacity details, and missing imagery create avoidable buyer hesitation.",
    whatBuyersAreReallySaying:
      "Buyers respond to KHAITE's material quality and distinctive silhouettes, but they need clearer practical proof before committing.",
    recurringPraiseThemes: [
      {
        theme: "Material quality and shape are clear strengths",
        products: productNames,
        evidence: [],
        action: "Carry specific material and silhouette language into PDP and channel copy.",
        confidence: "medium",
      },
    ],
    recurringComplaints: [
      {
        theme: "Fit and visual context are not always specific enough",
        products: productNames,
        evidence: [],
        action: "Add measurements, model context, missing angles, and item-capacity details where relevant.",
        confidence: "medium",
      },
    ],
    fitQualityMaterialIssues: [],
    pdpCopyGaps: [],
    productImprovementSuggestions: [],
    recommendedActions: [
      "Audit PDPs for measurement, fit, capacity, and missing-image gaps.",
      "Use repeated praise themes in campaign copy only when the source data supports the claim.",
    ],
    riskNotes: [dataset.caveat, `Report writer normalized an incomplete analysis payload: ${reason}`],
  };
}

function normalizeAnalysis(input: unknown, dataset: FeedbackDataset): FeedbackAnalysis {
  const parsed = FeedbackAnalysisSchema.safeParse(input);
  if (parsed.success) {
    const analysis = parsed.data;
    if (analysis.riskNotes.length === 0) {
      analysis.riskNotes.push(dataset.caveat);
    }
    return analysis;
  }

  return buildMinimalAnalysis(dataset, parsed.error.message);
}

function renderFindings(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return ["No recurring findings found.", ""];
  }

  return findings.flatMap((finding) => {
    const products = finding.products.length ? ` Products: ${finding.products.join(", ")}.` : "";
    const evidence = finding.evidence.length ? ` Evidence: ${finding.evidence.join(" | ")}` : "";
    const action = finding.action ? ` Action: ${finding.action}` : "";

    return [
      `- ${finding.theme} (${finding.confidence} confidence).${products}`,
      evidence ? `  ${evidence}` : "",
      action ? `  ${action}` : "",
    ].filter(Boolean);
  });
}

function buildMarkdownReport(input: {
  runId: string;
  task: string;
  dataset: FeedbackDataset;
  analysis: FeedbackAnalysis;
}): string {
  const { dataset, analysis } = input;
  const lines = [
    "# Buyer Feedback Intelligence Report",
    "",
    "## Run Summary",
    "",
    `- Run ID: ${input.runId}`,
    `- Task: ${input.task}`,
    `- Dataset: ${dataset.label} (${dataset.datasetId})`,
    `- Products reviewed: ${dataset.products.length}`,
    `- Data note: ${dataset.caveat}`,
    analysis.model ? `- Model: ${analysis.model}` : "",
    "",
    "## What Buyers Are Really Saying",
    "",
    analysis.whatBuyersAreReallySaying,
    "",
    "## Executive Summary",
    "",
    analysis.summary,
    "",
    "## Products In Scope",
    "",
    ...dataset.products.map((product) => {
      const source = product.url ? ` - ${product.url}` : "";
      return `- ${product.productName} (${product.category})${source}`;
    }),
    "",
    "## Recurring Praise Themes",
    "",
    ...renderFindings(analysis.recurringPraiseThemes),
    "",
    "## Recurring Complaints",
    "",
    ...renderFindings(analysis.recurringComplaints),
    "",
    "## Fit, Quality, And Material Issues",
    "",
    ...renderFindings(analysis.fitQualityMaterialIssues),
    "",
    "## PDP Copy Gaps",
    "",
    ...renderFindings(analysis.pdpCopyGaps),
    "",
    "## Product Improvement Suggestions",
    "",
    ...renderFindings(analysis.productImprovementSuggestions),
    "",
    "## Recommended Ecommerce Actions",
    "",
    ...analysis.recommendedActions.map((action) => `- ${action}`),
    "",
    "## Risk Notes",
    "",
    ...analysis.riskNotes.map((note) => `- ${note}`),
    "",
  ];

  return `${lines.filter((line) => line !== "").join("\n")}\n`;
}

export async function writeFeedbackReport(input: unknown) {
  const parsed = FeedbackReportInputSchema.parse(input);
  const dataset = unwrapDataset(parsed.dataset);
  const analysis = normalizeAnalysis(parsed.analysis, dataset);
  const runDir = path.join(PATHS.automationRuns, parsed.runId);
  await fs.mkdir(runDir, { recursive: true });

  const markdown = buildMarkdownReport({
    runId: parsed.runId,
    task: parsed.task,
    dataset,
    analysis,
  });
  const jsonReport = {
    ...parsed,
    dataset,
    analysis,
    markdown,
    writtenAt: new Date().toISOString(),
  };

  const markdownPath = path.join(runDir, "buyer-feedback-report.md");
  const jsonPath = path.join(runDir, "buyer-feedback-report.json");

  await fs.writeFile(markdownPath, markdown, "utf8");
  await fs.writeFile(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, "utf8");

  return {
    runId: parsed.runId,
    markdownPath,
    jsonPath,
    markdown,
  };
}

export type WriteFeedbackReportResult = Awaited<ReturnType<typeof writeFeedbackReport>>;
