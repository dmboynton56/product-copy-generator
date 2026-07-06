import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PATHS } from "@/lib/paths";
import { formatApiError, parseJsonFromModelText } from "@/lib/utils";
import { ReviewIssueSchema } from "@/validators/product";

const ReviewCopyInputSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      source: z.record(z.string(), z.unknown()),
      generated: z.object({
        description: z.string(),
        seo_title: z.string(),
        seo_meta_description: z.string(),
        image_alt_text: z.string(),
      }),
    }),
  ),
});

import { getCopyModel } from "@/lib/models";

async function loadReviewPrompt(): Promise<string> {
  return fs.readFile(PATHS.editorialReview, "utf8");
}

async function loadBrandVoice(): Promise<string> {
  return fs.readFile(PATHS.brandVoice, "utf8");
}

export async function reviewCopy(input: unknown) {
  const parsed = ReviewCopyInputSchema.parse(input);

  if (parsed.items.length === 0) {
    return {
      summary: "No generated items were available for review.",
      flaggedItems: [] as z.infer<typeof ReviewIssueSchema>[],
      reviewedAt: new Date().toISOString(),
      model: getCopyModel(),
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing.");
  }

  const brandVoice = await loadBrandVoice();
  const reviewPrompt = await loadReviewPrompt();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const payload = parsed.items.map((item) => ({
    id: item.productId,
    name: item.productName,
    source_product: item.source,
    description: item.generated.description,
    seo_title: item.generated.seo_title,
    seo_meta_description: item.generated.seo_meta_description,
    image_alt_text: item.generated.image_alt_text,
  }));

  const model = getCopyModel();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1800,
      temperature: 0.2,
      system: `You are a strict but practical editorial reviewer. Use this brand voice guide as the source of truth:\n\n${brandVoice}`,
      messages: [
        {
          role: "user",
          content: `${reviewPrompt}\n\nGenerated copy:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    const rawText = response.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("\n")
      .trim();

    const json = parseJsonFromModelText(rawText);
    const flaggedRaw = Array.isArray(json.flagged_items) ? json.flagged_items : [];

    const flaggedItems = flaggedRaw.map((item) => {
      const record = item as Record<string, unknown>;
      return ReviewIssueSchema.parse({
        productId: String(record.id ?? record.productId ?? "unknown"),
        issueType: String(record.issue_type ?? record.issueType ?? "consistency"),
        severity: String(record.severity ?? "low"),
        notes: String(record.notes ?? ""),
        suggestedFix: String(record.suggested_fix ?? record.suggestedFix ?? ""),
      });
    });

    return {
      summary: String(json.summary ?? ""),
      flaggedItems,
      reviewedAt: new Date().toISOString(),
      model,
    };
  } catch (error) {
    throw new Error(formatApiError(error));
  }
}

export type ReviewCopyResult = Awaited<ReturnType<typeof reviewCopy>>;
