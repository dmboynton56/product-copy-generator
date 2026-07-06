import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCardsFromHtml } from "@/tools/extract-khaite-collection";
import { extractKhaiteProductFromHtml } from "@/tools/extract-khaite-product";
import { PATHS } from "@/lib/paths";

describe("KHAITE extractors", () => {
  it("parses collection cards from fixture HTML", async () => {
    const html = await fs.readFile(
      path.join(PATHS.scrapedFixtures, "collection-new.html"),
      "utf8",
    );

    const result = extractCardsFromHtml(html, "https://khaite.com/collections/new", 5);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0]?.url).toMatch(/^https:\/\/khaite\.com\/products\//);
    expect(result.products[0]?.name.length).toBeGreaterThan(0);
  });

  it("parses product details from fixture HTML", async () => {
    const html = await fs.readFile(
      path.join(PATHS.scrapedFixtures, "product-inara-top.html"),
      "utf8",
    );

    const product = extractKhaiteProductFromHtml(
      html,
      "https://khaite.com/products/inara-top-in-ice-green",
      "2026-07-05T00:00:00.000Z",
    );

    expect(product.name).toContain("Inara Top");
    expect(product.price).toMatch(/\$/);
    expect(product.sku).toBeTruthy();
    expect(product.description).toBeTruthy();
    expect(product.source_evidence.fields_found).toContain("name");
  });
});
