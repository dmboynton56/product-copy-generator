export const DEFAULT_BANNED_CLICHES = [
  "timeless",
  "effortless",
  "must-have",
  "chic",
  "elevated",
  "iconic",
  "versatile",
  "luxurious",
];

export function parseBannedCliches(rawValue?: string | null): string[] {
  if (!rawValue) {
    return DEFAULT_BANNED_CLICHES;
  }

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function findBannedTerms(text: string, bannedTerms: string[]): string[] {
  const matches: string[] = [];

  for (const term of bannedTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
    if (pattern.test(text)) {
      matches.push(term);
    }
  }

  return matches;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export type SourceProduct = {
  name: string;
  materials?: string;
  color?: string;
  price?: string;
  care_instructions?: string;
  source_description?: string;
  url?: string;
};

export type GeneratedCopyFields = {
  description: string;
  seo_title: string;
  seo_meta_description: string;
  image_alt_text: string;
};

export type ValidationIssue = {
  productId: string;
  productName: string;
  issue: string;
};

export function detectFactualDrift(
  source: SourceProduct,
  generated: GeneratedCopyFields,
): string[] {
  const issues: string[] = [];
  const combined = `${generated.description} ${generated.seo_title} ${generated.seo_meta_description} ${generated.image_alt_text}`.toLowerCase();
  const sourceText = [
    source.name,
    source.materials,
    source.color,
    source.care_instructions,
    source.source_description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const riskyClaims = [
    "sustainable",
    "eco-friendly",
    "organic",
    "made in italy",
    "made in france",
    "runs small",
    "runs large",
    "vegan",
  ];

  for (const claim of riskyClaims) {
    if (combined.includes(claim) && !sourceText.includes(claim)) {
      issues.push(`Generated copy mentions "${claim}" but the source fields do not support it.`);
    }
  }

  return issues;
}

export function validateGeneratedCopy(
  productId: string,
  productName: string,
  source: SourceProduct,
  generated: GeneratedCopyFields,
  bannedCliches: string[] = DEFAULT_BANNED_CLICHES,
  generationError?: string | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (generationError) {
    issues.push({
      productId,
      productName,
      issue: `Generation error: ${generationError}`,
    });
  }

  if (generated.description) {
    const wordCount = countWords(generated.description);
    if (wordCount < 45 || wordCount > 80) {
      issues.push({
        productId,
        productName,
        issue: `Description is ${wordCount} words; expected 45-80 words.`,
      });
    }
  }

  if (generated.seo_title.length > 60) {
    issues.push({
      productId,
      productName,
      issue: `SEO title is ${generated.seo_title.length} characters; limit is 60.`,
    });
  }

  if (generated.seo_meta_description.length > 155) {
    issues.push({
      productId,
      productName,
      issue: `SEO meta description is ${generated.seo_meta_description.length} characters; limit is 155.`,
    });
  }

  if (generated.image_alt_text.length > 125) {
    issues.push({
      productId,
      productName,
      issue: `Image alt text is ${generated.image_alt_text.length} characters; limit is 125.`,
    });
  }

  const bannedMatches = findBannedTerms(generated.description, bannedCliches);
  if (bannedMatches.length > 0) {
    issues.push({
      productId,
      productName,
      issue: `Description contains banned cliche(s): ${bannedMatches.join(", ")}.`,
    });
  }

  for (const field of ["description", "seo_title", "seo_meta_description", "image_alt_text"] as const) {
    if (!generated[field].trim()) {
      issues.push({
        productId,
        productName,
        issue: `Missing generated field: ${field}.`,
      });
    }
  }

  for (const issue of detectFactualDrift(source, generated)) {
    issues.push({ productId, productName, issue });
  }

  return issues;
}

export function buildValidationReport(issues: ValidationIssue[], bannedCliches: string[]): string {
  const lines = [
    "# Validation Report",
    "",
    `Issues found: ${issues.length}`,
    `Banned cliches: ${bannedCliches.join(", ")}`,
    "",
  ];

  if (issues.length === 0) {
    lines.push("No validation issues found.");
    return `${lines.join("\n")}\n`;
  }

  for (const issue of issues) {
    lines.push(`## ${issue.productId}. ${issue.productName}`);
    lines.push(`- ${issue.issue}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
