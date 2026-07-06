"""Run an AI reviewer pass over generated product copy.

Pipeline step: AI review.

This script sends all generated descriptions to Claude in one call and asks for
tone, repetition, and consistency flags against the brand voice guide. It writes
both structured JSON and a human-readable markdown report.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv

from api_errors import format_api_error


ROOT_DIR = Path(__file__).resolve().parent
GENERATED_COPY_PATH = ROOT_DIR / "output" / "generated_copy.json"
BRAND_VOICE_PATH = ROOT_DIR / "prompts" / "brand_voice.md"
REVIEW_JSON_PATH = ROOT_DIR / "output" / "ai_review_report.json"
REVIEW_MD_PATH = ROOT_DIR / "output" / "ai_review_report.md"

DEFAULT_MODEL = "claude-sonnet-4-6"


def load_generated_items(path: Path) -> list[dict[str, Any]]:
    """Load generated copy and return only successfully generated items."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload.get("items", payload) if isinstance(payload, dict) else payload

    if not isinstance(items, list):
        raise ValueError("Generated copy must be a list or an object with an 'items' list.")

    return [
        item
        for item in items
        if not item.get("generation_error") and (item.get("generated_copy") or {}).get("description")
    ]


def load_brand_voice(path: Path) -> str:
    """Load the brand voice guide used for review criteria."""
    return path.read_text(encoding="utf-8").strip()


def get_model() -> str:
    """Read the model after .env has been loaded."""
    return os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)


def response_to_text(response: Any) -> str:
    """Extract text blocks from an Anthropic Messages API response."""
    text_parts: list[str] = []
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            text_parts.append(text)
    return "\n".join(text_parts).strip()


def parse_json_object(raw_text: str) -> dict[str, Any]:
    """Parse reviewer JSON, tolerating accidental markdown fences."""
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


def review_prompt(items: list[dict[str, Any]]) -> str:
    """Build one aggregate review prompt so Claude can compare descriptions."""
    review_items = []
    for item in items:
        source_product = item.get("source_product") or {}
        generated_copy = item.get("generated_copy") or {}
        review_items.append(
            {
                "id": item.get("id"),
                "name": source_product.get("name"),
                "source_product": source_product,
                "description": generated_copy.get("description"),
                "seo_title": generated_copy.get("seo_title"),
                "seo_meta_description": generated_copy.get("seo_meta_description"),
                "image_alt_text": generated_copy.get("image_alt_text"),
            }
        )

    return f"""
Review this generated product copy as a senior fashion e-commerce editor.

Look across all descriptions together and flag:
- off-tone writing
- repetitive sentence structures or repeated claims
- inconsistency with the brand voice guide
- invented details not present in the source product data
- weak SEO copy or unhelpful image alt text

Generated copy:
{json.dumps(review_items, indent=2)}

Return only valid JSON with this shape:
{{
  "summary": "Brief review summary.",
  "flagged_items": [
    {{
      "id": 1,
      "name": "Product name",
      "issue_type": "tone | repetition | consistency | factuality | seo | alt_text",
      "severity": "low | medium | high",
      "notes": "What needs attention.",
      "suggested_fix": "Concise recommended edit."
    }}
  ]
}}

If there are no issues, return an empty flagged_items array.
""".strip()


def run_ai_review(
    client: Anthropic,
    brand_voice: str,
    items: list[dict[str, Any]],
    model: str,
) -> dict[str, Any]:
    """Call Claude once for the full review pass."""
    response = client.messages.create(
        model=model,
        max_tokens=1800,
        temperature=0.2,
        system=(
            "You are a strict but practical editorial reviewer. Use this brand "
            f"voice guide as the source of truth:\n\n{brand_voice}"
        ),
        messages=[
            {
                "role": "user",
                "content": review_prompt(items),
            }
        ],
    )

    raw_text = response_to_text(response)
    try:
        parsed = parse_json_object(raw_text)
    except Exception as exc:
        parsed = {
            "summary": "Reviewer response could not be parsed as JSON.",
            "flagged_items": [],
            "parse_error": format_api_error(exc),
            "raw_response": raw_text,
        }

    parsed.setdefault("summary", "")
    parsed.setdefault("flagged_items", [])
    parsed["reviewed_at"] = datetime.now(timezone.utc).isoformat()
    parsed["model"] = model
    return parsed


def build_markdown_report(review: dict[str, Any]) -> str:
    """Convert structured reviewer output into a human-readable report."""
    lines = [
        "# AI Review Report",
        "",
        f"Model: {review.get('model', DEFAULT_MODEL)}",
        f"Reviewed at: {review.get('reviewed_at', '')}",
        "",
        "## Summary",
        "",
        str(review.get("summary") or "No summary provided."),
        "",
        "## Flagged Items",
        "",
    ]

    flagged_items = review.get("flagged_items") or []
    if not flagged_items:
        lines.append("No AI review issues flagged.")
    else:
        for item in flagged_items:
            lines.append(f"### {item.get('id', '?')}. {item.get('name', 'Unnamed product')}")
            lines.append(f"- Type: {item.get('issue_type', 'unspecified')}")
            lines.append(f"- Severity: {item.get('severity', 'unspecified')}")
            lines.append(f"- Notes: {item.get('notes', '')}")
            lines.append(f"- Suggested fix: {item.get('suggested_fix', '')}")
            lines.append("")

    if review.get("parse_error"):
        lines.extend(
            [
                "",
                "## Parse Error",
                "",
                str(review["parse_error"]),
                "",
                "The raw reviewer response is available in output/ai_review_report.json.",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    """Run AI review and write structured and human-readable output."""
    load_dotenv()

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise SystemExit(
            "ANTHROPIC_API_KEY is missing. Add it to .env or export it in your shell."
        )

    items = load_generated_items(GENERATED_COPY_PATH)
    if not items:
        raise SystemExit(
            "No successfully generated descriptions found. Run generate.py before review.py."
        )

    brand_voice = load_brand_voice(BRAND_VOICE_PATH)
    model = get_model()
    client = Anthropic()
    review = run_ai_review(client, brand_voice, items, model)
    markdown_report = build_markdown_report(review)

    REVIEW_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    REVIEW_JSON_PATH.write_text(json.dumps(review, indent=2, ensure_ascii=False), encoding="utf-8")
    REVIEW_MD_PATH.write_text(markdown_report, encoding="utf-8")

    print(markdown_report)
    print(f"Wrote AI review JSON to {REVIEW_JSON_PATH}")
    print(f"Wrote AI review report to {REVIEW_MD_PATH}")


if __name__ == "__main__":
    main()
