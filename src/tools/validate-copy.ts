import { z } from "zod";
import {
  buildValidationReport,
  parseBannedCliches,
  validateGeneratedCopy,
  type ValidationIssue,
} from "@/validators/validation-rules";

const ValidateCopyInputSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      source: z.object({
        name: z.string(),
        materials: z.string().optional(),
        color: z.string().optional(),
        price: z.string().optional(),
        care_instructions: z.string().optional(),
        source_description: z.string().optional(),
        url: z.string().optional(),
      }),
      generated: z.object({
        description: z.string(),
        seo_title: z.string(),
        seo_meta_description: z.string(),
        image_alt_text: z.string(),
      }),
      generationError: z.string().nullable().optional(),
    }),
  ),
  bannedCliches: z.array(z.string()).optional(),
});

export async function validateCopy(input: unknown) {
  const parsed = ValidateCopyInputSchema.parse(input);
  const bannedCliches = parsed.bannedCliches ?? parseBannedCliches(process.env.BANNED_CLICHES);

  const issues: ValidationIssue[] = [];
  for (const item of parsed.items) {
    issues.push(
      ...validateGeneratedCopy(
        item.productId,
        item.productName,
        item.source,
        item.generated,
        bannedCliches,
        item.generationError,
      ),
    );
  }

  return {
    issueCount: issues.length,
    issues,
    reportMarkdown: buildValidationReport(issues, bannedCliches),
    bannedCliches,
  };
}

export type ValidateCopyResult = Awaited<ReturnType<typeof validateCopy>>;
