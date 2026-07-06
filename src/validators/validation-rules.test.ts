import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANNED_CLICHES,
  validateGeneratedCopy,
} from "@/validators/validation-rules";

describe("validation rules", () => {
  it("flags SEO and word-count issues", () => {
    const issues = validateGeneratedCopy(
      "1",
      "Test Product",
      { name: "Test Product" },
      {
        description: "Too short.",
        seo_title: "A".repeat(61),
        seo_meta_description: "Valid meta",
        image_alt_text: "Valid alt",
      },
      DEFAULT_BANNED_CLICHES,
    );

    expect(issues.some((issue) => issue.issue.includes("45-80 words"))).toBe(true);
    expect(issues.some((issue) => issue.issue.includes("SEO title"))).toBe(true);
  });
});
