import path from "node:path";

export const PROJECT_ROOT = path.resolve(process.cwd());

export const PATHS = {
  brandVoice: path.join(PROJECT_ROOT, "prompts", "brand_voice.md"),
  copyGeneration: path.join(PROJECT_ROOT, "prompts", "copy_generation.md"),
  editorialReview: path.join(PROJECT_ROOT, "prompts", "editorial_review.md"),
  feedbackSample: path.join(PROJECT_ROOT, "data", "feedback", "khaite-buyer-feedback.sample.json"),
  scrapedDir: path.join(PROJECT_ROOT, "data", "scraped"),
  scrapedFixtures: path.join(PROJECT_ROOT, "data", "scraped", "fixtures"),
  automationRuns: path.join(PROJECT_ROOT, "output", "automation_runs"),
};

export const ALLOWED_DOMAINS = ["khaite.com", "www.khaite.com"];

export const USER_AGENT = "ProductCopyGenerator/1.0 (portfolio demo; +https://github.com/)";
