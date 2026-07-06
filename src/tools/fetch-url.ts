import fs from "node:fs/promises";
import path from "node:path";
import { PATHS, USER_AGENT } from "@/lib/paths";
import { assertAllowedUrl } from "@/lib/utils";
import {
  FetchUrlInputSchema,
  FetchUrlOutputSchema,
} from "@/validators/product";
import type { z } from "zod";

type FetchUrlOutput = z.infer<typeof FetchUrlOutputSchema>;

function cachePathForUrl(url: string): string {
  const parsed = new URL(url);
  const slug = parsed.pathname.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return path.join(PATHS.scrapedFixtures, `${slug || "page"}.html`);
}

export async function fetchUrl(input: unknown): Promise<FetchUrlOutput> {
  const { url } = FetchUrlInputSchema.parse(input);
  assertAllowedUrl(url);

  if (process.env.USE_HTML_CACHE === "1") {
    const cachePath = cachePathForUrl(url);
    try {
      const html = await fs.readFile(cachePath, "utf8");
      return FetchUrlOutputSchema.parse({
        url,
        status: 200,
        content_type: "text/html",
        html,
        fetched_at: new Date().toISOString(),
      });
    } catch {
      // fall through to network fetch
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30_000),
  });

  const html = await response.text();
  const output = FetchUrlOutputSchema.parse({
    url,
    status: response.status,
    content_type: response.headers.get("content-type") ?? "text/html",
    html,
    fetched_at: new Date().toISOString(),
  });

  if (process.env.SAVE_HTML_CACHE === "1" && response.ok) {
    const cachePath = cachePathForUrl(url);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, html, "utf8");
  }

  return output;
}

export type FetchUrlResult = Awaited<ReturnType<typeof fetchUrl>>;
