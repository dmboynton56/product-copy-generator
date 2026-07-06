# Product Catalog Automation Builder Plan

## Goal

Turn the current CSV-based Claude product copy generator into a more complete automation demo that can gather real product information from a fashion brand site, enrich or rewrite catalog copy, validate the output, and show the full agent workflow step by step.

The strongest interview story is not just "Claude writes product descriptions." It is:

> A user gives a plain-English task, Claude decides which tools to use, the app fetches real catalog data, generates structured product copy, validates it, runs an editorial review, and produces a report with traceable source links.

## Why This Is Worth Building

The current project already covers:

- Claude API calls.
- System prompts and brand voice guidance.
- Structured JSON output.
- A multi-step generation, validation, and AI review workflow.
- Deterministic checks for SEO limits and banned language.

The missing automation-builder pieces are:

- Claude tool use, where the model chooses actions instead of only responding to a prompt.
- A tool execution loop: Claude requests a tool, the app runs it, the result goes back to Claude, and the loop continues.
- Real external data intake from a company website.
- A frontend that shows the automation steps as they happen.
- Source-backed outputs with product URLs and extraction evidence.
- Optional MCP integration or MCP-like tool boundaries.

## Proposed Product

Build a "Catalog Copy Automation Builder" for fashion e-commerce.

Example user task:

> Pull the latest KHAITE new arrivals, extract product details for the first 12 items, generate clean PDP copy in our brand voice, validate SEO limits, flag factual risks, and create a merchandising report.

The app should produce:

- A normalized product dataset.
- Generated copy for each product.
- A validation report.
- An AI editorial review report.
- A visible run log showing each tool call and result.
- Source URLs for every product used.

## Source Sites And References

Primary demo source:

- KHAITE: https://khaite.com/

Observed useful public data on KHAITE pages:

- Category navigation such as New Arrivals, Ready-to-Wear, Handbags, Shoes, Jewelry, Sale, and seasonal collections.
- Product listing data such as product name, price, color swatches, product image alt text, and product page URLs.
- Product page data such as name, price, sizes, color, material, SKU, description, size and fit, material and care, and shipping text.

Technical references:

- Claude tool use overview: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Claude tool-using agent tutorial: https://platform.claude.com/docs/en/agents-and-tools/tool-use/build-a-tool-using-agent
- MCP introduction: https://modelcontextprotocol.io/docs/getting-started/intro
- Inspiration article: https://medium.com/@leithmajdoub/10-automations-you-can-build-with-claude-mcp-today-36329a51f429

## Recommended Architecture

Use a full-stack TypeScript app for the interview-facing version, while preserving the existing Python scripts as a working baseline and reference implementation.

Recommended stack:

- Next.js with TypeScript for frontend and backend routes.
- Anthropic TypeScript SDK for Claude API calls.
- Zod for tool input/output schemas and structured validation.
- Cheerio for fast HTML extraction from public product pages.
- Playwright only if KHAITE pages require browser rendering for data that is not present in HTML.
- SQLite with Prisma, or simple JSON files for the first MVP.
- Server-sent events or WebSockets for streaming the run log to the UI.
- Tailwind CSS or plain CSS modules for a clean, utilitarian interface.

Why TypeScript/Next.js:

- It demonstrates frontend and backend in one project.
- It maps better to common product-engineering interview expectations.
- It makes tool schemas, API routes, and UI state easy to explain.
- It avoids splitting the demo between a Python backend and a separate frontend.

Keep Python scripts for now:

- `generate.py`, `validate.py`, and `review.py` remain the proof that the core workflow exists.
- The TypeScript version can port the logic incrementally.
- If time is short, the frontend can call the existing scripts through a backend route before the full TypeScript port is complete.

## Target Repository Structure

```text
product-copy-generator/
├── AUTOMATION_BUILDER_PLAN.md
├── README.md
├── data/
│   ├── products.csv
│   └── scraped/
│       └── khaite-products.sample.json
├── prompts/
│   ├── brand_voice.md
│   ├── copy_generation.md
│   └── editorial_review.md
├── output/
│   ├── generated_copy.json
│   ├── validation_report.md
│   ├── ai_review_report.json
│   └── automation_runs/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── runs/
│   │       │   └── route.ts
│   │       └── runs/[runId]/events/
│   │           └── route.ts
│   ├── agent/
│   │   ├── loop.ts
│   │   ├── prompts.ts
│   │   ├── types.ts
│   │   └── tools.ts
│   ├── tools/
│   │   ├── fetch-url.ts
│   │   ├── search-web.ts
│   │   ├── extract-khaite-collection.ts
│   │   ├── extract-khaite-product.ts
│   │   ├── generate-copy.ts
│   │   ├── validate-copy.ts
│   │   ├── review-copy.ts
│   │   └── write-report.ts
│   ├── validators/
│   │   ├── product.ts
│   │   ├── generated-copy.ts
│   │   └── validation-rules.ts
│   ├── storage/
│   │   ├── runs.ts
│   │   └── files.ts
│   └── ui/
│       ├── RunConsole.tsx
│       ├── ProductTable.tsx
│       ├── CopyReviewPanel.tsx
│       └── ReportViewer.tsx
├── mcp/
│   └── catalog-server/
│       ├── package.json
│       └── src/index.ts
├── generate.py
├── validate.py
├── review.py
└── requirements.txt
```

## Automation Flow

1. User enters a natural-language task in the UI.
2. Backend starts an automation run and sends the task to Claude with tool definitions.
3. Claude chooses a tool, such as `extract_khaite_collection`.
4. The app executes that tool and stores the result.
5. The result is returned to Claude as a `tool_result`.
6. Claude chooses the next tool, such as `extract_khaite_product` for each product URL.
7. The app continues the loop until Claude returns a final response.
8. The UI shows the tool timeline, extracted products, generated copy, validation issues, and final report.

## Tool Design

### `search_web`

Purpose:

- Find relevant public pages for a brand, category, or product query.

Implementation options:

- MVP: allowlisted web search API or Anthropic server-side web search if available.
- MCP version: connect a Brave Search, DuckDuckGo, or other search MCP server.

Input:

```json
{
  "query": "KHAITE new arrivals products",
  "allowed_domains": ["khaite.com"]
}
```

Output:

```json
{
  "results": [
    {
      "title": "New Arrivals from KHAITE",
      "url": "https://khaite.com/collections/new",
      "snippet": "..."
    }
  ]
}
```

### `fetch_url`

Purpose:

- Fetch a page and return normalized HTML/text with metadata.

Implementation:

- Use `fetch` for server-rendered pages.
- Fall back to Playwright for pages that require JavaScript rendering.
- Enforce an allowlist for demo safety, starting with `khaite.com`.
- Add rate limiting and clear user-agent metadata.

Input:

```json
{
  "url": "https://khaite.com/products/inara-top-in-ice-green"
}
```

Output:

```json
{
  "url": "https://khaite.com/products/inara-top-in-ice-green",
  "status": 200,
  "content_type": "text/html",
  "html": "...",
  "fetched_at": "2026-07-05T00:00:00.000Z"
}
```

### `extract_khaite_collection`

Purpose:

- Parse a KHAITE collection page and return product cards with URLs.

Input:

```json
{
  "collection_url": "https://khaite.com/collections/new",
  "limit": 12
}
```

Output:

```json
{
  "collection_url": "https://khaite.com/collections/new",
  "products": [
    {
      "name": "Inara Top",
      "url": "https://khaite.com/products/inara-top-in-ice-green",
      "price": "$1,680",
      "image_alt": "INARA TOP ICE GREEN 24814232 499 GHOST"
    }
  ]
}
```

### `extract_khaite_product`

Purpose:

- Parse a product page into normalized catalog fields.

Input:

```json
{
  "url": "https://khaite.com/products/inara-top-in-ice-green"
}
```

Output:

```json
{
  "name": "Inara Top",
  "url": "https://khaite.com/products/inara-top-in-ice-green",
  "price": "$1,680",
  "color": "Ice Green",
  "materials": "80% lyocell, 20% silk",
  "description": "Source product description from the site.",
  "sku": "24814232-499",
  "size_and_fit": "True to size...",
  "care_instructions": "Dry clean",
  "source_evidence": {
    "fetched_at": "2026-07-05T00:00:00.000Z",
    "fields_found": ["name", "price", "color", "materials", "description", "sku", "care_instructions"]
  }
}
```

### `generate_copy`

Purpose:

- Generate structured product copy using the existing brand voice rules.

Input:

```json
{
  "product": {
    "name": "Inara Top",
    "materials": "80% lyocell, 20% silk",
    "color": "Ice Green",
    "price": "$1,680",
    "care_instructions": "Dry clean",
    "source_description": "..."
  }
}
```

Output:

```json
{
  "description": "...",
  "seo_title": "...",
  "seo_meta_description": "...",
  "image_alt_text": "..."
}
```

### `validate_copy`

Purpose:

- Run deterministic checks before any AI review.

Checks:

- Description word count.
- SEO title length.
- SEO meta description length.
- Image alt text length.
- Banned cliches.
- Missing fields.
- Possible factual drift from source fields.

### `review_copy`

Purpose:

- Ask Claude to review the full batch for tone, repetition, consistency, SEO quality, and factual risk.

This keeps the current evaluator pattern but makes it source-aware by including the extracted KHAITE fields and URLs.

### `write_report`

Purpose:

- Produce a final Markdown and JSON report for the run.

Report sections:

- Run summary.
- Source collection URL.
- Products extracted.
- Generated copy.
- Validation issues.
- AI review flags.
- Recommended next actions.

## MCP Strategy

There are two viable paths.

### Path A: MCP-Inspired App Tools

Build the tool loop directly in the app using Claude client tools.

Pros:

- Fastest to implement.
- Easier to debug.
- Best fit for a portfolio demo.
- No extra MCP client/server complexity.

Cons:

- It demonstrates tool use, but not a real MCP server.

### Path B: Local MCP Catalog Server

Create a small local MCP server under `mcp/catalog-server` that exposes:

- `search_web`
- `fetch_url`
- `extract_khaite_collection`
- `extract_khaite_product`
- `write_catalog_report`

The Next.js app can either:

- Call the MCP server through an MCP client, or
- Keep the MCP server as a standalone demo that can be connected to Claude Desktop or another MCP-compatible host.

Pros:

- Stronger automation-builder interview signal.
- Gives a concrete answer if asked about MCP servers, tools, schemas, and resources.
- Separates catalog capabilities from the app UI.

Cons:

- More moving parts.
- More setup steps.
- Not necessary for the first working MVP.

Recommended sequence:

1. Build Path A first.
2. Add Path B after the app works end to end.

## Frontend Experience

The app should open directly into the working tool, not a marketing page.

Primary screen:

- Task input at the top.
- Preset task buttons:
  - "Analyze KHAITE new arrivals"
  - "Generate PDP copy for handbags"
  - "Review source copy for SEO risks"
- Live run console showing tool calls and statuses.
- Product table with extracted catalog data.
- Generated copy panel.
- Validation and review panel.
- Final report viewer with export buttons.

Important UI states:

- Waiting for task.
- Running tool call.
- Fetching product pages.
- Generating copy.
- Validation complete.
- Review complete.
- Failed run with clear error message.

The key interview feature is the visible agent timeline. The user should be able to see that Claude is not just chatting; it is selecting and executing tools.

## Data Model

### `AutomationRun`

```ts
type AutomationRun = {
  id: string;
  task: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  finalSummary?: string;
};
```

### `ToolEvent`

```ts
type ToolEvent = {
  id: string;
  runId: string;
  sequence: number;
  toolName: string;
  status: "requested" | "running" | "completed" | "failed";
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
};
```

### `CatalogProduct`

```ts
type CatalogProduct = {
  id: string;
  sourceUrl: string;
  name: string;
  price?: string;
  color?: string;
  materials?: string;
  careInstructions?: string;
  sizeAndFit?: string;
  sku?: string;
  sourceDescription?: string;
  imageAltText?: string;
  extractedAt: string;
};
```

### `GeneratedCopy`

```ts
type GeneratedCopy = {
  productId: string;
  description: string;
  seoTitle: string;
  seoMetaDescription: string;
  imageAltText: string;
  model: string;
  generatedAt: string;
};
```

### `ReviewIssue`

```ts
type ReviewIssue = {
  productId: string;
  issueType: "tone" | "repetition" | "consistency" | "factuality" | "seo" | "alt_text" | "validation";
  severity: "low" | "medium" | "high";
  notes: string;
  suggestedFix: string;
};
```

## Implementation Phases

### Phase 1: Stabilize Current CLI Workflow

Scope:

- Keep the existing Python scripts.
- Add a small fixture output file that does not require live Anthropic credits.
- Add tests for validation logic.
- Make API errors easier to summarize.

Deliverable:

- A reliable CLI baseline that can be demoed even if the API has billing or network issues.

### Phase 2: Add Catalog Extraction

Scope:

- Implement `fetch_url`.
- Implement `extract_khaite_collection`.
- Implement `extract_khaite_product`.
- Save normalized extracted products to `data/scraped/`.
- Add tests using saved HTML fixtures.

Deliverable:

- Run a command like `npm run scrape:khaite -- --collection https://khaite.com/collections/new --limit 12`.

### Phase 3: Port Workflow To TypeScript Tools

Scope:

- Port copy generation to `generate_copy`.
- Port validation to `validate_copy`.
- Port AI review to `review_copy`.
- Use Zod schemas for inputs and outputs.

Deliverable:

- A script can run the complete workflow from real product URLs to final reports.

### Phase 4: Add Claude Agent Loop

Scope:

- Define all tools in the Anthropic Messages API request.
- Implement the loop for `tool_use` and `tool_result`.
- Stream or persist every tool event.
- Add safety limits:
  - Maximum tool calls per run.
  - Maximum product pages per run.
  - Allowed domains.
  - Request timeout.
  - Retry limits.

Deliverable:

- User task goes in; Claude chooses extraction, generation, validation, review, and report tools.

### Phase 5: Build The UI

Scope:

- Add a task input and preset prompts.
- Show live run events.
- Show product extraction results.
- Show generated copy and review issues.
- Add report export.

Deliverable:

- A full-stack app that demonstrates the automation in a browser.

### Phase 6: Optional MCP Server

Scope:

- Create `mcp/catalog-server`.
- Expose catalog extraction tools over MCP.
- Add a README section explaining how the MCP server maps to the app tools.

Deliverable:

- A compact, interview-ready MCP story:
  - Tools expose catalog actions.
  - Claude or another MCP host can call them.
  - The same business logic powers both the app and MCP server.

## Safety And Compliance Guardrails

- Use public product pages only.
- Respect website terms, robots policies, and rate limits.
- Add domain allowlisting.
- Cache fetched pages during development.
- Do not scrape account-only or cart-only data.
- Do not present generated copy as official KHAITE copy.
- Keep source URLs and timestamps with every generated result.
- Avoid invented product claims; generation must be grounded in extracted source fields.
- Include a "factual risk" validation step when generated text mentions anything not present in source data.

## Interview Talking Points

This project can support the following answers:

- "I started with a deterministic pipeline, then converted it into a tool-using agent."
- "Claude does not directly scrape. Claude decides when to call tools; my application executes those tools and returns structured results."
- "I used deterministic validation before AI review so the system is not relying only on another model call."
- "Every output is source-backed with product URLs and extraction timestamps."
- "I treated MCP as a boundary for tools and resources. The MVP uses app-local tools, and the next phase exposes the same capabilities through a local MCP server."
- "The UI shows each tool call so a nontechnical user can understand what the automation did."

## MVP Definition

The smallest strong version should do all of this:

1. Accept a task in a web UI.
2. Fetch one KHAITE collection page.
3. Extract 5 product URLs.
4. Fetch and parse each product page.
5. Generate structured copy for each product.
6. Validate copy deterministically.
7. Run one AI review pass.
8. Display a live tool timeline and final report.

This is enough to show full-stack work, Claude API usage, tool calling, real data extraction, and an actual automation workflow.

## Recommended Next Step

Build Phase 2 first: real catalog extraction. It creates the biggest jump in project credibility because the app stops depending on a hand-written CSV and starts operating on live public product data.
