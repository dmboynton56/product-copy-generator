import { z } from "zod";

export const CatalogProductSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  name: z.string(),
  price: z.string().optional(),
  color: z.string().optional(),
  materials: z.string().optional(),
  careInstructions: z.string().optional(),
  sizeAndFit: z.string().optional(),
  sku: z.string().optional(),
  sourceDescription: z.string().optional(),
  imageAltText: z.string().optional(),
  extractedAt: z.string(),
});

export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export const CollectionProductCardSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  price: z.string().optional(),
  image_alt: z.string().optional(),
});

export const ExtractKhaiteCollectionInputSchema = z.object({
  collection_url: z.string().url(),
  limit: z.number().int().positive().max(50).default(12),
});

export const ExtractKhaiteCollectionOutputSchema = z.object({
  collection_url: z.string().url(),
  products: z.array(CollectionProductCardSchema),
});

export const ExtractKhaiteProductInputSchema = z.object({
  url: z.string().url(),
});

export const SourceEvidenceSchema = z.object({
  fetched_at: z.string(),
  fields_found: z.array(z.string()),
});

export const ExtractKhaiteProductOutputSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  price: z.string().optional(),
  color: z.string().optional(),
  materials: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  size_and_fit: z.string().optional(),
  care_instructions: z.string().optional(),
  source_evidence: SourceEvidenceSchema,
});

export const FetchUrlInputSchema = z.object({
  url: z.string().url(),
});

export const FetchUrlOutputSchema = z.object({
  url: z.string().url(),
  status: z.number(),
  content_type: z.string(),
  html: z.string(),
  fetched_at: z.string(),
});

export const GeneratedCopyFieldsSchema = z.object({
  description: z.string(),
  seo_title: z.string(),
  seo_meta_description: z.string(),
  image_alt_text: z.string(),
});

export const GeneratedCopySchema = z.object({
  productId: z.string(),
  description: z.string(),
  seoTitle: z.string(),
  seoMetaDescription: z.string(),
  imageAltText: z.string(),
  model: z.string(),
  generatedAt: z.string(),
});

export const ReviewIssueSchema = z.object({
  productId: z.string(),
  issueType: z.enum([
    "tone",
    "repetition",
    "consistency",
    "factuality",
    "seo",
    "alt_text",
    "validation",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  notes: z.string(),
  suggestedFix: z.string(),
});

export const ValidationIssueSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  issue: z.string(),
});

export const AutomationRunSchema = z.object({
  id: z.string(),
  task: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  finalSummary: z.string().optional(),
  error: z.string().optional(),
});

export const ToolEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  sequence: z.number(),
  toolName: z.string(),
  status: z.enum(["requested", "running", "completed", "failed"]),
  input: z.unknown(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export type AutomationRun = z.infer<typeof AutomationRunSchema>;
export type ToolEvent = z.infer<typeof ToolEventSchema>;
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export type RunSummary = {
  id: string;
  task: string;
  status: AutomationRun["status"];
  startedAt: string;
  completedAt?: string;
  productCount: number;
  eventCount: number;
  error?: string;
};
