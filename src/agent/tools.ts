import type Anthropic from "@anthropic-ai/sdk";
import { fetchUrl } from "@/tools/fetch-url";
import { searchWeb } from "@/tools/search-web";
import { extractKhaiteCollection } from "@/tools/extract-khaite-collection";
import { extractKhaiteProduct } from "@/tools/extract-khaite-product";
import { generateCopy } from "@/tools/generate-copy";
import { validateCopy } from "@/tools/validate-copy";
import { reviewCopy } from "@/tools/review-copy";
import { writeReport } from "@/tools/write-report";
import { loadFeedbackDataset } from "@/tools/load-feedback-dataset";
import { analyzeBuyerFeedback } from "@/tools/analyze-buyer-feedback";
import { writeFeedbackReport } from "@/tools/write-feedback-report";

export type ToolName =
  | "search_web"
  | "fetch_url"
  | "extract_khaite_collection"
  | "extract_khaite_product"
  | "generate_copy"
  | "validate_copy"
  | "review_copy"
  | "write_report"
  | "load_feedback_dataset"
  | "analyze_buyer_feedback"
  | "write_feedback_report";

export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: "search_web",
    description: "Find relevant public KHAITE pages for a brand, category, or product query.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        allowed_domains: { type: "array", items: { type: "string" } },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch a public page and return metadata plus a short HTML preview. Prefer extract_khaite_collection or extract_khaite_product instead when possible.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "extract_khaite_collection",
    description: "Parse a KHAITE collection page and return product cards with URLs.",
    input_schema: {
      type: "object",
      properties: {
        collection_url: { type: "string" },
        limit: { type: "number" },
      },
      required: ["collection_url"],
    },
  },
  {
    name: "extract_khaite_product",
    description: "Parse a KHAITE product page into normalized catalog fields.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_copy",
    description: "Generate structured product copy using the brand voice rules.",
    input_schema: {
      type: "object",
      properties: {
        product: {
          type: "object",
          properties: {
            name: { type: "string" },
            materials: { type: "string" },
            color: { type: "string" },
            price: { type: "string" },
            care_instructions: { type: "string" },
            source_description: { type: "string" },
            url: { type: "string" },
          },
          required: ["name"],
        },
        productId: { type: "string" },
      },
      required: ["product"],
    },
  },
  {
    name: "validate_copy",
    description: "Run deterministic checks on generated copy before AI review.",
    input_schema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object" } },
      },
      required: ["items"],
    },
  },
  {
    name: "review_copy",
    description: "Ask Claude to review the full batch for tone, repetition, consistency, SEO quality, and factual risk.",
    input_schema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object" } },
      },
      required: ["items"],
    },
  },
  {
    name: "write_report",
    description: "Produce a final Markdown and JSON report for the run.",
    input_schema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        task: { type: "string" },
        collectionUrl: { type: "string" },
        products: { type: "array", items: { type: "object" } },
        generatedItems: { type: "array", items: { type: "object" } },
        validation: { type: "object" },
        review: { type: "object" },
        finalSummary: { type: "string" },
      },
      required: ["runId", "task", "products", "generatedItems", "validation", "review"],
    },
  },
  {
    name: "load_feedback_dataset",
    description:
      "Load a mock retail buyer-feedback dataset with verified reviews, client service notes, return reasons, and size/fit signals.",
    input_schema: {
      type: "object",
      properties: {
        dataset: {
          type: "string",
          enum: ["khaite-buyer-feedback-sample"],
          description: "Use the default mock KHAITE buyer-feedback sample for demos.",
        },
      },
    },
  },
  {
    name: "analyze_buyer_feedback",
    description:
      "Analyze buyer feedback for praise themes, complaints, fit/quality/material issues, PDP copy gaps, product suggestions, and ecommerce actions.",
    input_schema: {
      type: "object",
      properties: {
        dataset: { type: "object" },
      },
      required: ["dataset"],
    },
  },
  {
    name: "write_feedback_report",
    description: "Produce a final Markdown and JSON customer intelligence report for buyer-feedback analysis.",
    input_schema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        task: { type: "string" },
        dataset: { type: "object" },
        analysis: { type: "object" },
      },
      required: ["runId", "task", "dataset", "analysis"],
    },
  },
];

export async function executeTool(name: ToolName, input: unknown): Promise<unknown> {
  switch (name) {
    case "search_web":
      return searchWeb(input);
    case "fetch_url":
      return fetchUrl(input);
    case "extract_khaite_collection":
      return extractKhaiteCollection(input);
    case "extract_khaite_product":
      return extractKhaiteProduct(input);
    case "generate_copy":
      return generateCopy(input);
    case "validate_copy":
      return validateCopy(input);
    case "review_copy":
      return reviewCopy(input);
    case "write_report":
      return writeReport(input);
    case "load_feedback_dataset":
      return loadFeedbackDataset(input);
    case "analyze_buyer_feedback":
      return analyzeBuyerFeedback(input);
    case "write_feedback_report":
      return writeFeedbackReport(input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
