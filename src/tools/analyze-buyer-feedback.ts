import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getCopyModel } from "@/lib/models";
import { formatApiError, parseJsonFromModelText } from "@/lib/utils";
import type { FeedbackDataset } from "@/tools/load-feedback-dataset";

const FeedbackFindingSchema = z.object({
  theme: z.string(),
  products: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  action: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

const FeedbackAnalysisSchema = z.object({
  summary: z.string(),
  whatBuyersAreReallySaying: z.string(),
  recurringPraiseThemes: z.array(FeedbackFindingSchema),
  recurringComplaints: z.array(FeedbackFindingSchema),
  fitQualityMaterialIssues: z.array(FeedbackFindingSchema),
  pdpCopyGaps: z.array(FeedbackFindingSchema),
  productImprovementSuggestions: z.array(FeedbackFindingSchema),
  recommendedActions: z.array(z.string()),
  riskNotes: z.array(z.string()),
});

const FeedbackDatasetInputSchema = z.object({
  datasetId: z.string(),
  label: z.string(),
  generatedAt: z.string(),
  caveat: z.string(),
  products: z.array(z.record(z.string(), z.unknown())),
});

const AnalyzeBuyerFeedbackInputSchema = z.object({
  dataset: z.union([
    FeedbackDatasetInputSchema,
    z.object({
      dataset: FeedbackDatasetInputSchema,
    }),
  ]),
});

function unwrapDataset(input: z.infer<typeof AnalyzeBuyerFeedbackInputSchema>["dataset"]) {
  if ("dataset" in input) {
    return input.dataset;
  }

  return input;
}

function buildPrompt(dataset: FeedbackDataset): string {
  return `Analyze this retail buyer-feedback dataset for an ecommerce, merchandising, creative, and product team.

Return only JSON with exactly these keys:
- summary: string
- whatBuyersAreReallySaying: string
- recurringPraiseThemes: array of { theme, products, evidence, action, confidence }
- recurringComplaints: array of { theme, products, evidence, action, confidence }
- fitQualityMaterialIssues: array of { theme, products, evidence, action, confidence }
- pdpCopyGaps: array of { theme, products, evidence, action, confidence }
- productImprovementSuggestions: array of { theme, products, evidence, action, confidence }
- recommendedActions: array of concise strings
- riskNotes: array of concise strings

Rules:
- Treat the dataset caveat as important context.
- Do not claim this is real customer data.
- Ground each finding in the supplied reviews, support notes, return reasons, or fit feedback.
- Write in a practical retail operations voice.
- Keep each array to 2 or 3 findings.
- Keep evidence snippets under 16 words each.
- Escape quotation marks inside JSON strings.

Dataset:
${JSON.stringify(dataset, null, 2)}`;
}

function buildFallbackAnalysis(dataset: FeedbackDataset, parseError: string): z.infer<typeof FeedbackAnalysisSchema> {
  const productNames = dataset.products.map((product) => product.productName);
  const productList = productNames.join(", ");

  return {
    summary:
      "The mock feedback points to strong demand for KHAITE's material quality, refined shapes, and styling versatility, with conversion risk concentrated in fit clarity, measurements, capacity details, and missing imagery.",
    whatBuyersAreReallySaying:
      "Buyers like the product design and quality, but they want more precise proof before purchasing: garment length, stretch, model context, bag capacity, interior views, and clearer fit expectations.",
    recurringPraiseThemes: [
      {
        theme: "Material quality is a purchase driver",
        products: ["Inara Top", "Maeve Jean", "Lotus Mini Bag"],
        evidence: ["Beautiful weight and color", "denim feels substantial", "leather is soft but holds shape"],
        action: "Bring material hand-feel and structure into PDP bullets and creative briefs.",
        confidence: "high",
      },
      {
        theme: "Distinctive shapes feel refined without being loud",
        products: ["Inara Top", "Maeve Jean", "Lotus Mini Bag"],
        evidence: ["neckline and knit feel refined", "leg shape looks modern", "Love the shape"],
        action: "Keep silhouette language specific and source-backed in PDP and email copy.",
        confidence: "high",
      },
    ],
    recurringComplaints: [
      {
        theme: "Fit expectations are not clear enough",
        products: ["Inara Top", "Maeve Jean"],
        evidence: ["Too cropped for expected fit", "waist ran smaller than expected"],
        action: "Add clearer garment measurements and between-size guidance.",
        confidence: "high",
      },
      {
        theme: "Key product views are missing",
        products: ["Inara Top", "Maeve Jean", "Lotus Mini Bag"],
        evidence: ["back view more clearly", "model height", "photo of the interior"],
        action: "Prioritize missing views in product photography shot lists.",
        confidence: "high",
      },
    ],
    fitQualityMaterialIssues: [
      {
        theme: "Cropped and structured fits need explicit guidance",
        products: ["Inara Top", "Maeve Jean"],
        evidence: ["Runs short on long torsos", "Structured waist"],
        action: "State fit intent and add measurements near size selector.",
        confidence: "high",
      },
      {
        theme: "Material stretch questions create hesitation",
        products: ["Inara Top"],
        evidence: ["whether the knit would stretch with wear"],
        action: "Clarify stretch, recovery, and care expectations when source data supports it.",
        confidence: "medium",
      },
    ],
    pdpCopyGaps: [
      {
        theme: "Measurement and model context gaps",
        products: ["Inara Top", "Maeve Jean"],
        evidence: ["measurement guidance did not", "could not tell how tall the model was"],
        action: "Add model height, size worn, garment length, rise, and inseam context.",
        confidence: "high",
      },
      {
        theme: "Bag capacity and interior details are under-explained",
        products: ["Lotus Mini Bag"],
        evidence: ["whether a phone, card case, keys, and lipstick fit", "interior and strap drop"],
        action: "Add capacity copy, interior image, dimensions, and strap-drop detail.",
        confidence: "high",
      },
    ],
    productImprovementSuggestions: [
      {
        theme: "Use feedback to refine size guidance, not product positioning",
        products: ["Inara Top", "Maeve Jean"],
        evidence: ["exchange for a size up", "Too cropped"],
        action: "Update size notes before considering product changes.",
        confidence: "medium",
      },
      {
        theme: "Creative coverage can reduce avoidable returns",
        products: productNames,
        evidence: ["back view", "model height", "interior image"],
        action: "Build a missing-angle checklist for PDP photography QA.",
        confidence: "high",
      },
    ],
    recommendedActions: [
      `Review PDPs for ${productList} against fit, measurement, and imagery gaps.`,
      "Add source-backed fit notes near the size selector for cropped or structured items.",
      "Create a creative shot-list checklist for back view, scale, interior, model height, and capacity.",
      "Use repeated praise themes in email and merchandising copy without inventing unsupported claims.",
    ],
    riskNotes: [
      dataset.caveat,
      `Claude returned malformed JSON, so the app used a deterministic fallback analysis. Parser detail: ${parseError}`,
    ],
  };
}

export async function analyzeBuyerFeedback(input: unknown) {
  const parsed = AnalyzeBuyerFeedbackInputSchema.parse(input);
  const dataset = unwrapDataset(parsed.dataset);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = getCopyModel();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 3200,
      temperature: 0.2,
      system:
        "You are a senior retail ecommerce analyst. You connect buyer feedback to merchandising, PDP content, creative, and product actions without overstating weak evidence.",
      messages: [{ role: "user", content: buildPrompt(dataset as FeedbackDataset) }],
    });

    const rawText = response.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("\n")
      .trim();

    let analysis: z.infer<typeof FeedbackAnalysisSchema>;
    try {
      const json = parseJsonFromModelText(rawText);
      analysis = FeedbackAnalysisSchema.parse(json);
    } catch (parseError) {
      analysis = buildFallbackAnalysis(dataset as FeedbackDataset, formatApiError(parseError));
    }

    return {
      ...analysis,
      datasetId: dataset.datasetId,
      analyzedAt: new Date().toISOString(),
      model,
    };
  } catch (error) {
    throw new Error(formatApiError(error));
  }
}

export type AnalyzeBuyerFeedbackResult = Awaited<ReturnType<typeof analyzeBuyerFeedback>>;
