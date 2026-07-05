"""Generate product copy from raw catalog data with the Claude API.

Pipeline step: generation.

This script reads data/products.csv, applies prompts/brand_voice.md, calls Claude
once per product, and writes structured JSON to output/generated_copy.json.
"""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
DATA_PATH = ROOT_DIR / "data" / "products.csv"
BRAND_VOICE_PATH = ROOT_DIR / "prompts" / "brand_voice.md"
OUTPUT_PATH = ROOT_DIR / "output" / "generated_copy.json"

DEFAULT_MODEL = "claude-sonnet-4-6"

REQUIRED_PRODUCT_FIELDS = [
    "name",
    "materials",
    "color",
    "price",
    "care_instructions",
]

COPY_FIELDS = [
    "description",
    "seo_title",
    "seo_meta_description",
    "image_alt_text",
]


def load_products(path: Path) -> list[dict[str, str]]:
    """Read source products and verify the required CSV columns are present."""
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        missing_fields = [field for field in REQUIRED_PRODUCT_FIELDS if field not in (reader.fieldnames or [])]
        if missing_fields:
            raise ValueError(f"Missing required CSV columns: {', '.join(missing_fields)}")

        return [
            {field: (row.get(field) or "").strip() for field in REQUIRED_PRODUCT_FIELDS}
            for row in reader
        ]


def load_brand_voice(path: Path) -> str:
    """Load the reusable brand voice prompt that guides every generation call."""
    return path.read_text(encoding="utf-8").strip()


def get_model() -> str:
    """Read the model after .env has been loaded."""
    return os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)


def build_user_prompt(product: dict[str, str]) -> str:
    """Build one product-specific prompt with a strict JSON response contract."""
    product_json = json.dumps(product, indent=2)
    return f"""
Generate catalog copy for this product.

Source product data:
{product_json}

Return only valid JSON with exactly these string fields:
- description
- seo_title
- seo_meta_description
- image_alt_text

Constraints:
- Description must be 45-80 words.
- SEO title must be under 60 characters.
- SEO meta description must be under 155 characters.
- Image alt text must be factual, specific, and under 125 characters.
- Do not use banned cliches from the brand voice guide.
- Do not include markdown, commentary, or extra keys.
""".strip()


def response_to_text(response: Any) -> str:
    """Extract text blocks from an Anthropic Messages API response."""
    text_parts: list[str] = []
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            text_parts.append(text)
    return "\n".join(text_parts).strip()


def parse_json_object(raw_text: str) -> dict[str, Any]:
    """Parse Claude output, tolerating accidental fenced code blocks or prefaces."""
    cleaned = raw_text.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        parsed = json.loads(cleaned[start : end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object.")

    return parsed


def normalize_copy(parsed: dict[str, Any]) -> dict[str, str]:
    """Keep only the fields the rest of the pipeline expects."""
    return {
        field: str(parsed.get(field, "")).strip()
        for field in COPY_FIELDS
    }


def empty_copy() -> dict[str, str]:
    """Return a copy-shaped object for failed generations."""
    return {field: "" for field in COPY_FIELDS}


def generate_for_product(
    client: Anthropic,
    brand_voice: str,
    product: dict[str, str],
    product_id: int,
    model: str,
) -> dict[str, Any]:
    """Call Claude once for a single product and gracefully capture failures."""
    raw_text = ""
    try:
        response = client.messages.create(
            model=model,
            max_tokens=900,
            temperature=0.35,
            system=(
                "You are an expert fashion e-commerce copywriter. Follow this "
                f"brand voice guide exactly:\n\n{brand_voice}"
            ),
            messages=[
                {
                    "role": "user",
                    "content": build_user_prompt(product),
                }
            ],
        )
        raw_text = response_to_text(response)
        parsed = parse_json_object(raw_text)

        return {
            "id": product_id,
            "source_product": product,
            "generated_copy": normalize_copy(parsed),
            "generation_error": None,
            "raw_response": None,
        }
    except Exception as exc:
        return {
            "id": product_id,
            "source_product": product,
            "generated_copy": empty_copy(),
            "generation_error": str(exc),
            "raw_response": raw_text or None,
        }


def main() -> None:
    """Run generation and persist a machine-readable output file."""
    load_dotenv()

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise SystemExit(
            "ANTHROPIC_API_KEY is missing. Add it to .env or export it in your shell."
        )

    products = load_products(DATA_PATH)
    brand_voice = load_brand_voice(BRAND_VOICE_PATH)
    model = get_model()
    client = Anthropic()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    items: list[dict[str, Any]] = []
    for index, product in enumerate(products, start=1):
        print(f"Generating copy for {index}/{len(products)}: {product['name']}")
        items.append(generate_for_product(client, brand_voice, product, index, model))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "source_csv": str(DATA_PATH.relative_to(ROOT_DIR)),
        "brand_voice": str(BRAND_VOICE_PATH.relative_to(ROOT_DIR)),
        "items": items,
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(items)} generated items to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
