import { ALLOWED_DOMAINS } from "@/lib/paths";

export function assertAllowedUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol for URL: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new Error(`Domain not allowed: ${parsed.hostname}`);
  }

  return parsed;
}

export function normalizeProductUrl(url: string, base = "https://khaite.com"): string {
  const parsed = new URL(url, base);
  parsed.hash = "";
  parsed.search = "";

  const productMatch = parsed.pathname.match(/\/products\/([^/]+)/);
  if (productMatch) {
    return `https://khaite.com/products/${productMatch[1]}`;
  }

  return parsed.toString();
}

export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatUsdPrice(raw: string | number | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }

  const numeric = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(numeric)) {
    return String(raw);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function parseJsonFromModelText(rawText: string): Record<string, unknown> {
  let cleaned = rawText.trim();

  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    if (lines[0]?.startsWith("```")) {
      lines.shift();
    }
    if (lines.at(-1)?.startsWith("```")) {
      lines.pop();
    }
    cleaned = lines.join("\n").trim();
  }

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error("Expected a JSON object in model output.");
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    const body = (error as Error & { error?: { type?: string; message?: string } }).error;
    if (body?.message) {
      return body.type ? `${body.type}: ${body.message}` : body.message;
    }

    const message = error.message.trim();
    if (message.toLowerCase().includes("credit balance")) {
      return "Anthropic billing error: credit balance too low to run this request.";
    }
    if (message.length > 240) {
      return `${message.slice(0, 237)}...`;
    }
    return message || error.name;
  }

  return String(error);
}
