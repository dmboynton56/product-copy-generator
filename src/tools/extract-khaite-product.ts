import * as cheerio from "cheerio";
import {
  ExtractKhaiteProductInputSchema,
  ExtractKhaiteProductOutputSchema,
} from "@/validators/product";
import { fetchUrl } from "@/tools/fetch-url";
import { formatUsdPrice, normalizeProductUrl } from "@/lib/utils";

type JsonLdProductGroup = {
  name?: string;
  description?: string;
  url?: string;
  hasVariant?: Array<{
    sku?: string;
    name?: string;
    offers?: { price?: string | number; priceCurrency?: string };
  }>;
};

function parseJsonLdProduct(html: string): JsonLdProductGroup | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (const element of scripts.toArray()) {
    const raw = $(element).html()?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as JsonLdProductGroup;
      if (parsed.hasVariant?.length || parsed.name) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractDetailBlock($: cheerio.CheerioAPI, label: string): string | undefined {
  let found: string | undefined;

  $(".product-details__descriptions-block").each((_index, block) => {
    const blockLabel = $(block)
      .find("label, button, summary, h2, h3, h4")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (blockLabel.toLowerCase() !== label.toLowerCase()) {
      return;
    }

    const value = $(block)
      .find(".product-details__descriptions-block-text")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (value) {
      found = value;
    }
  });

  return found;
}

function splitMaterialAndCare(value: string | undefined): {
  materials?: string;
  careInstructions?: string;
} {
  if (!value) {
    return {};
  }

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return {};
  }

  const materials = sentences[0];
  const careInstructions = sentences.slice(1).join(" ") || undefined;

  return { materials, careInstructions };
}

function parseVariantFields(variantName: string | undefined): {
  color?: string;
  materials?: string;
} {
  if (!variantName) {
    return {};
  }

  const parts = variantName.split("/").map((part) => part.trim());
  const color = parts[1];
  const materials = parts[2]?.replace(/(\d+)([A-Z]+)/g, "$1% $2").replace(/,/g, ", ");

  return {
    color: color || undefined,
    materials: materials || undefined,
  };
}

export function extractKhaiteProductFromHtml(html: string, url: string, fetchedAt: string) {
  const normalizedUrl = normalizeProductUrl(url);
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLdProduct(html);
  const firstVariant = jsonLd?.hasVariant?.find((variant) => variant.offers?.price) ?? jsonLd?.hasVariant?.[0];
  const variantFields = parseVariantFields(firstVariant?.name);

  const name =
    jsonLd?.name?.replace(/\s+in\s+.+$/i, "").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    "Unknown product";

  const color =
    variantFields.color ||
    name.match(/\bin\s+(.+)$/i)?.[1]?.trim() ||
    undefined;

  const materialAndCare = extractDetailBlock($, "Material and Care");
  const parsedMaterialAndCare = splitMaterialAndCare(materialAndCare);

  const materials =
    variantFields.materials ||
    parsedMaterialAndCare.materials ||
    undefined;

  const description = jsonLd?.description || extractDetailBlock($, "Details");
  const sizeAndFit = extractDetailBlock($, "Size and Fit");
  const careInstructions = parsedMaterialAndCare.careInstructions;

  const fieldsFound = [
    name && "name",
    firstVariant?.offers?.price && "price",
    color && "color",
    materials && "materials",
    description && "description",
    firstVariant?.sku && "sku",
    sizeAndFit && "size_and_fit",
    careInstructions && "care_instructions",
  ].filter(Boolean) as string[];

  return ExtractKhaiteProductOutputSchema.parse({
    name,
    url: normalizedUrl,
    price: formatUsdPrice(firstVariant?.offers?.price),
    color,
    materials,
    description,
    sku: firstVariant?.sku,
    size_and_fit: sizeAndFit,
    care_instructions: careInstructions,
    source_evidence: {
      fetched_at: fetchedAt,
      fields_found: fieldsFound,
    },
  });
}

export async function extractKhaiteProduct(input: unknown) {
  const { url } = ExtractKhaiteProductInputSchema.parse(input);
  const fetched = await fetchUrl({ url });
  if (fetched.status >= 400) {
    throw new Error(`Failed to fetch product page (${fetched.status})`);
  }

  return extractKhaiteProductFromHtml(fetched.html, url, fetched.fetched_at);
}
