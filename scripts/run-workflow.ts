import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PATHS } from "../src/lib/paths";
import { generateCopy } from "../src/tools/generate-copy";
import { validateCopy } from "../src/tools/validate-copy";
import { reviewCopy } from "../src/tools/review-copy";
import { writeReport } from "../src/tools/write-report";

async function main() {
  const inputPath =
    process.argv[2] ?? path.join(PATHS.scrapedDir, "khaite-products.sample.json");
  const raw = JSON.parse(await fs.readFile(inputPath, "utf8")) as {
    collection_url?: string;
    products: Array<Record<string, unknown>>;
  };

  const runId = randomUUID();
  const generatedItems = [];

  for (const product of raw.products) {
    const productId = String(product.url ?? product.name);
    console.log(`Generating copy for ${product.name}`);

    try {
      const generated = await generateCopy({
        productId,
        product: {
          name: String(product.name ?? "Unknown"),
          materials: product.materials ? String(product.materials) : undefined,
          color: product.color ? String(product.color) : undefined,
          price: product.price ? String(product.price) : undefined,
          care_instructions: product.care_instructions
            ? String(product.care_instructions)
            : undefined,
          source_description: product.description ? String(product.description) : undefined,
          url: product.url ? String(product.url) : undefined,
        },
      });

      generatedItems.push({
        productId,
        productName: String(product.name ?? "Unknown"),
        source: {
          name: String(product.name ?? "Unknown"),
          materials: product.materials ? String(product.materials) : undefined,
          color: product.color ? String(product.color) : undefined,
          price: product.price ? String(product.price) : undefined,
          care_instructions: product.care_instructions
            ? String(product.care_instructions)
            : undefined,
          source_description: product.description ? String(product.description) : undefined,
          url: product.url ? String(product.url) : undefined,
        },
        generated: {
          description: generated.description,
          seo_title: generated.seoTitle,
          seo_meta_description: generated.seoMetaDescription,
          image_alt_text: generated.imageAltText,
        },
        generationError: null,
      });
    } catch (error) {
      generatedItems.push({
        productId,
        productName: String(product.name ?? "Unknown"),
        source: {
          name: String(product.name ?? "Unknown"),
          url: product.url ? String(product.url) : undefined,
        },
        generated: {
          description: "",
          seo_title: "",
          seo_meta_description: "",
          image_alt_text: "",
        },
        generationError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const validation = await validateCopy({ items: generatedItems });
  const review = await reviewCopy({
    items: generatedItems
      .filter((item) => !item.generationError && item.generated.description)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        source: item.source,
        generated: item.generated,
      })),
  });

  const report = await writeReport({
    runId,
    task: "Run workflow from scraped KHAITE products",
    collectionUrl: raw.collection_url,
    products: raw.products,
    generatedItems,
    validation,
    review,
    finalSummary: review.summary,
  });

  console.log(`Workflow complete. Report written to ${report.markdownPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
