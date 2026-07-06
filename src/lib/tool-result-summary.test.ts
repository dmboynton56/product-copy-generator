import { describe, expect, it } from "vitest";
import { sanitizeToolResultForAgent } from "@/lib/tool-result-summary";

describe("sanitizeToolResultForAgent", () => {
  it("strips full html from fetch_url results", () => {
    const sanitized = sanitizeToolResultForAgent("fetch_url", {
      url: "https://khaite.com/collections/new",
      status: 200,
      content_type: "text/html",
      html: "<html>" + "x".repeat(50_000) + "</html>",
      fetched_at: "2026-07-05T00:00:00.000Z",
    }) as Record<string, unknown>;

    expect(sanitized.html).toBeUndefined();
    expect(sanitized.html_length).toBeGreaterThan(50_000);
    expect(String(sanitized.html_preview).length).toBeLessThanOrEqual(400);
    expect(JSON.stringify(sanitized).length).toBeLessThan(2_000);
  });

  it("omits validate_copy markdown bodies", () => {
    const sanitized = sanitizeToolResultForAgent("validate_copy", {
      issueCount: 1,
      issues: [{ productId: "1", productName: "Test", issue: "Too short" }],
      reportMarkdown: "# Validation Report\n".repeat(100),
    }) as Record<string, unknown>;

    expect(String(sanitized.reportMarkdown)).toContain("omitted");
  });
});
