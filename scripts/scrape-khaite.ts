#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../src/lib/paths";
import { extractKhaiteCollection } from "../src/tools/extract-khaite-collection";
import { extractKhaiteProduct } from "../src/tools/extract-khaite-product";
import { sleep } from "../src/lib/utils";

function parseArgs(argv: string[]) {
  let collectionUrl = "https://khaite.com/collections/new";
  let limit = 12;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--collection" && argv[index + 1]) {
      collectionUrl = argv[index + 1];
      index += 1;
    } else if (arg === "--limit" && argv[index + 1]) {
      limit = Number(argv[index + 1]);
      index += 1;
    }
  }

  return { collectionUrl, limit };
}

async function main() {
  const { collectionUrl, limit } = parseArgs(process.argv.slice(2));
  console.log(`Scraping ${collectionUrl} (limit ${limit})`);

  const collection = await extractKhaiteCollection({
    collection_url: collectionUrl,
    limit,
  });

  const products = [];
  for (const card of collection.products) {
    console.log(`Fetching ${card.name} -> ${card.url}`);
    const product = await extractKhaiteProduct({ url: card.url });
    products.push({
      ...product,
      collection_card: card,
    });
    await sleep(1000);
  }

  const output = {
    scraped_at: new Date().toISOString(),
    collection_url: collectionUrl,
    limit,
    products,
  };

  await fs.mkdir(PATHS.scrapedDir, { recursive: true });
  const outputPath = path.join(PATHS.scrapedDir, "khaite-products.sample.json");
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${products.length} products to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
