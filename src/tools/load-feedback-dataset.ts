import fs from "node:fs/promises";
import { z } from "zod";
import { PATHS } from "@/lib/paths";

const FeedbackEntrySchema = z.object({
  source: z.string(),
  rating: z.number().optional(),
  text: z.string(),
  tags: z.array(z.string()).default([]),
});

const ReturnReasonSchema = z.object({
  reason: z.string(),
  count: z.number(),
});

const FeedbackProductSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  category: z.string(),
  url: z.string().url().optional(),
  reviews: z.array(FeedbackEntrySchema),
  returnReasons: z.array(ReturnReasonSchema),
  fitFeedback: z.array(z.string()),
});

const FeedbackDatasetSchema = z.object({
  datasetId: z.string(),
  label: z.string(),
  generatedAt: z.string(),
  caveat: z.string(),
  products: z.array(FeedbackProductSchema),
});

const LoadFeedbackDatasetInputSchema = z.object({
  dataset: z.enum(["khaite-buyer-feedback-sample"]).default("khaite-buyer-feedback-sample"),
});

export type FeedbackDataset = z.infer<typeof FeedbackDatasetSchema>;

export async function loadFeedbackDataset(input: unknown) {
  LoadFeedbackDatasetInputSchema.parse(input ?? {});

  const raw = await fs.readFile(PATHS.feedbackSample, "utf8");
  const dataset = FeedbackDatasetSchema.parse(JSON.parse(raw));
  const reviewCount = dataset.products.reduce((count, product) => count + product.reviews.length, 0);
  const returnReasonCount = dataset.products.reduce(
    (count, product) => count + product.returnReasons.length,
    0,
  );
  const fitSignalCount = dataset.products.reduce((count, product) => count + product.fitFeedback.length, 0);

  return {
    dataset,
    summary: {
      productCount: dataset.products.length,
      reviewCount,
      returnReasonCount,
      fitSignalCount,
      caveat: dataset.caveat,
    },
  };
}

export type LoadFeedbackDatasetResult = Awaited<ReturnType<typeof loadFeedbackDataset>>;
