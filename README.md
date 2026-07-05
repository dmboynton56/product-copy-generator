# Product Copy Generator

A small portfolio demo that uses the Claude API to turn raw fashion catalog data into polished product copy.

The pipeline has three steps:

1. Generation: read `data/products.csv`, apply the brand voice guide, and generate structured product copy with Claude.
2. Deterministic validation: check SEO length limits and banned cliches.
3. AI review: send all generated descriptions back to Claude for a second-pass review of tone, repetition, and consistency.

## Project Structure

```text
product-copy-generator/
├── README.md
├── data/
│   └── products.csv
├── prompts/
│   └── brand_voice.md
├── generate.py
├── validate.py
├── review.py
├── output/
│   └── generated_copy.json
├── requirements.txt
├── .env.example
└── .gitignore
```

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add your Anthropic API key to `.env`:

```bash
ANTHROPIC_API_KEY=your_key_here
```

The default model is `claude-sonnet-4-6`. You can override it in `.env` with `ANTHROPIC_MODEL`.

## Run the Pipeline

Generate copy:

```bash
python generate.py
```

Run deterministic validation:

```bash
python validate.py
```

Run the AI reviewer pass:

```bash
python review.py
```

## Outputs

Generated files are written under `output/`:

- `generated_copy.json`: structured copy for each product.
- `validation_report.md`: human-readable deterministic validation report.
- `ai_review_report.json`: structured second-pass review from Claude.
- `ai_review_report.md`: human-readable AI review report.

`output/` and `.env` are ignored by git so local generated copy and secrets do not get committed.

## Configuration

The banned cliche list defaults to:

```text
timeless, effortless, must-have, chic, elevated, iconic, versatile, luxurious
```

Override it with an environment variable:

```bash
BANNED_CLICHES="timeless,effortless,must-have"
python validate.py
```

Or pass it directly:

```bash
python validate.py --banned-cliches "timeless,effortless,must-have"
```

