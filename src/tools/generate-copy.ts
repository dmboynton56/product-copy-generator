import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PATHS } from "@/lib/paths";
import { formatApiError, parseJsonFromModelText } from "@/lib/utils";
import { GeneratedCopyFieldsSchema, GeneratedCopySchema } from "@/validators/product";

const GenerateCopyInputSchema = z.object({
  product: z.object({
    name: z.string(),
    materials: z.string().optional(),
    color: z.string().optional(),
    price: z.string().optional(),
    care_instructions: z.string().optional(),
    source_description: z.string().optional(),
    url: z.string().optional(),
  }),
  productId: z.string().optional(),
});

import { getCopyModel } from "@/lib/models";

async function loadPromptTemplate(): Promise<string> {
  return fs.readFile(PATHS.copyGeneration, "utf8");
}

async function loadBrandVoice(): Promise<string> {
  return fs.readFile(PATHS.brandVoice, "utf8");
}

function buildUserPrompt(template: string, product: z.infer<typeof GenerateCopyInputSchema>["product"]): string {
  return template.replace("{{product_json}}", JSON.stringify(product, null, 2)).trim();
}

export async function generateCopy(input: unknown) {
  const parsed = GenerateCopyInputSchema.parse(input);
  const productId = parsed.productId ?? parsed.product.url ?? parsed.product.name;
  const brandVoice = await loadBrandVoice();
  const template = await loadPromptTemplate();
  const userPrompt = buildUserPrompt(template, parsed.product);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const model = getCopyModel();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 900,
      temperature: 0.35,
      system: `You are an expert fashion e-commerce copywriter. Follow this brand voice guide exactly:\n\n${brandVoice}`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = response.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("\n")
      .trim();

    const json = parseJsonFromModelText(rawText);
    const generated = GeneratedCopyFieldsSchema.parse({
      description: String(json.description ?? ""),
      seo_title: String(json.seo_title ?? ""),
      seo_meta_description: String(json.seo_meta_description ?? ""),
      image_alt_text: String(json.image_alt_text ?? ""),
    });

    return GeneratedCopySchema.parse({
      productId,
      description: generated.description,
      seoTitle: generated.seo_title,
      seoMetaDescription: generated.seo_meta_description,
      imageAltText: generated.image_alt_text,
      model,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(formatApiError(error));
  }
}

export type GenerateCopyResult = Awaited<ReturnType<typeof generateCopy>>;
