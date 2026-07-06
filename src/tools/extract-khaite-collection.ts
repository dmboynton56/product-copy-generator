import * as cheerio from "cheerio";
import {
  ExtractKhaiteCollectionInputSchema,
  ExtractKhaiteCollectionOutputSchema,
} from "@/validators/product";
import { fetchUrl } from "@/tools/fetch-url";
import { formatUsdPrice, normalizeProductUrl, slugToTitle } from "@/lib/utils";

function extractCardsFromHtml(html: string, collectionUrl: string, limit: number) {
  const $ = cheerio.load(html);
  const products = new Map<
    string,
    { name: string; url: string; price?: string; image_alt?: string }
  >();

  $(".product-card").each((_index, card) => {
    const titleLink = $(card).find(".product-card__title a").first();
    const href = titleLink.attr("href");
    if (!href) {
      return;
    }

    const url = normalizeProductUrl(href);
    const name = titleLink.text().trim() || slugToTitle(url.split("/").pop() ?? "product");
    const price = $(card).find(".product-card__price").first().text().replace(/\s+/g, " ").trim();
    const imageAlt = $(card).find(".product-card__media-link img").first().attr("alt") ?? undefined;

    products.set(url, {
      name,
      url,
      price: price || undefined,
      image_alt: imageAlt,
    });
  });

  if (products.size === 0) {
    $("a[href*='/products/']").each((_index, anchor) => {
      const href = $(anchor).attr("href");
      if (!href) {
        return;
      }

      const url = normalizeProductUrl(href);
      if (products.has(url)) {
        return;
      }

      const name =
        $(anchor).text().trim() ||
        slugToTitle(url.split("/").pop()?.replace(/-\d+$/, "") ?? "product");

      products.set(url, { name, url });
    });
  }

  return {
    collection_url: collectionUrl,
    products: Array.from(products.values()).slice(0, limit),
  };
}

export async function extractKhaiteCollection(input: unknown) {
  const parsed = ExtractKhaiteCollectionInputSchema.parse(input);
  const fetched = await fetchUrl({ url: parsed.collection_url });
  if (fetched.status >= 400) {
    throw new Error(`Failed to fetch collection page (${fetched.status})`);
  }

  const result = extractCardsFromHtml(fetched.html, parsed.collection_url, parsed.limit);
  return ExtractKhaiteCollectionOutputSchema.parse(result);
}

export { extractCardsFromHtml };
