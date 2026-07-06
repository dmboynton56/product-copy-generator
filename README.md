# Product Copy Generator

A portfolio demo that turns fashion catalog data into polished, source-backed product copy using Claude.

It now includes:

- A Python CSV pipeline baseline (`generate.py`, `validate.py`, `review.py`)
- Live KHAITE catalog extraction tools
- A TypeScript workflow for generation, validation, review, and reporting
- A mock buyer-feedback analyzer for customer intelligence and PDP gap detection
- A Claude tool-use agent loop with a browser UI
- An optional MCP catalog server

## Project Structure

```text
product-copy-generator/
├── README.md
├── fixtures/
├── data/
│   ├── products.csv
│   └── scraped/
├── prompts/
├── src/
│   ├── app/
│   ├── agent/
│   ├── tools/
│   ├── validators/
│   ├── storage/
│   └── ui/
├── mcp/catalog-server/
├── scripts/
├── generate.py
├── validate.py
└── review.py
```

## Setup

### Python baseline

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### TypeScript app

```bash
npm install
cp .env.example .env
```

Add your Anthropic API key to `.env`:

```bash
ANTHROPIC_API_KEY=your_key_here
```

Model defaults:

- `ANTHROPIC_AGENT_MODEL=claude-haiku-4-5` for the tool-orchestration agent loop
- `ANTHROPIC_COPY_MODEL=claude-sonnet-4-6` for generation and review
- `ANTHROPIC_MODEL` remains a fallback for copy tasks

The agent strips full HTML from `fetch_url` tool results before sending them back to Claude, which keeps run costs much lower.

## Python Pipeline

Generate copy:

```bash
python generate.py
```

Run deterministic validation:

```bash
python validate.py
```

Validate against committed fixture data without calling the API:

```bash
python validate.py --input fixtures/generated_copy.sample.json
pytest
```

Run the AI reviewer pass:

```bash
python review.py
```

## Catalog Extraction

Scrape a KHAITE collection and product pages:

```bash
npm run scrape:khaite -- --collection https://khaite.com/collections/new --limit 12
```

Use cached HTML fixtures during development:

```bash
USE_HTML_CACHE=1 npm run scrape:khaite -- --collection https://khaite.com/collections/new --limit 5
```

Output is written to `data/scraped/khaite-products.sample.json`.

## TypeScript Workflow

Run the full workflow from scraped products to final report:

```bash
npm run workflow:run
```

This requires a valid `ANTHROPIC_API_KEY`.

## Web App

Start the automation builder UI:

```bash
npm run dev
```

Open `http://localhost:3000`.

The UI lets you:

- Enter a plain-English automation task
- Use preset tasks such as "Buyer feedback analyzer" and "PDP copy workflow"
- Watch the live tool timeline over SSE
- Inspect feedback inputs, extracted products, generated copy, validation issues, and final reports

API routes:

- `POST /api/runs`
- `GET /api/runs/[runId]`
- `GET /api/runs/[runId]/events`

## MCP Catalog Server

The MCP server exposes the same catalog capabilities for Claude Desktop or other MCP hosts:

- `search_web`
- `fetch_url`
- `extract_khaite_collection`
- `extract_khaite_product`
- `write_catalog_report`

Run it:

```bash
npm run mcp:catalog
```

Example Claude Desktop config:

```json
{
  "mcpServers": {
    "catalog-server": {
      "command": "npm",
      "args": ["run", "mcp:catalog"],
      "cwd": "/absolute/path/to/product-copy-generator"
    }
  }
}
```

Tool mapping:

| MCP tool | App tool |
| --- | --- |
| `search_web` | `search_web` |
| `fetch_url` | `fetch_url` |
| `extract_khaite_collection` | `extract_khaite_collection` |
| `extract_khaite_product` | `extract_khaite_product` |
| `write_catalog_report` | `write_report` |

## Outputs

Generated files are written under `output/`:

- `generated_copy.json`
- `validation_report.md`
- `ai_review_report.json`
- `ai_review_report.md`
- `automation_runs/{runId}/report.md`
- `automation_runs/{runId}/report.json`
- `automation_runs/{runId}/buyer-feedback-report.md`
- `automation_runs/{runId}/buyer-feedback-report.json`

`output/` and `.env` are ignored by git.

## Configuration

The banned cliche list defaults to:

```text
timeless, effortless, must-have, chic, elevated, iconic, versatile, luxurious
```

Override it with:

```bash
BANNED_CLICHES="timeless,effortless,must-have"
python validate.py
```

Or:

```bash
python validate.py --banned-cliches "timeless,effortless,must-have"
```

## Safety Notes

- Public KHAITE pages only
- Domain allowlist enforced in fetch tools
- Buyer-feedback samples are synthetic demo data, not real KHAITE customer records
- Source URLs and timestamps are preserved with extracted and generated data
- Generated copy is demo output, not official brand copy
