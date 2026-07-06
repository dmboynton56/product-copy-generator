"""Validate generated product copy with deterministic rules.

Pipeline step: deterministic validation.

This script checks output/generated_copy.json for SEO length limits and banned
cliches. It writes a human-readable report to output/validation_report.md.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_PATH = ROOT_DIR / "output" / "generated_copy.json"
DEFAULT_REPORT_PATH = ROOT_DIR / "output" / "validation_report.md"

DEFAULT_BANNED_CLICHES = [
    "timeless",
    "effortless",
    "must-have",
    "chic",
    "elevated",
    "iconic",
    "versatile",
    "luxurious",
]


def load_generated_copy(path: Path) -> list[dict[str, Any]]:
    """Load generated output and return the item list."""
    payload = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        return payload["items"]

    raise ValueError("Generated copy must be a list or an object with an 'items' list.")


def parse_banned_cliches(cli_value: str | None) -> list[str]:
    """Allow the banned list to be configured from CLI or environment."""
    raw_value = cli_value or os.getenv("BANNED_CLICHES")
    if not raw_value:
        return DEFAULT_BANNED_CLICHES

    return [item.strip() for item in raw_value.split(",") if item.strip()]


def count_words(text: str) -> int:
    """Count words in a text block using simple whitespace splitting."""
    return len([word for word in text.split() if word.strip()])


def find_banned_terms(text: str, banned_terms: list[str]) -> list[str]:
    """Find banned terms as whole words or exact hyphenated phrases."""
    matches: list[str] = []
    for term in banned_terms:
        escaped = re.escape(term)
        pattern = rf"(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])"
        if re.search(pattern, text, flags=re.IGNORECASE):
            matches.append(term)
    return matches


def item_name(item: dict[str, Any]) -> str:
    """Return a readable product name for reports."""
    source_product = item.get("source_product") or {}
    return str(source_product.get("name") or item.get("name") or f"Item {item.get('id', '?')}")


def validate_item(item: dict[str, Any], banned_cliches: list[str]) -> list[str]:
    """Run deterministic checks for one generated item."""
    issues: list[str] = []
    generated_copy = item.get("generated_copy") or item

    if item.get("generation_error"):
        issues.append(f"Generation error: {item['generation_error']}")

    seo_title = str(generated_copy.get("seo_title", ""))
    seo_meta_description = str(generated_copy.get("seo_meta_description", ""))
    description = str(generated_copy.get("description", ""))
    image_alt_text = str(generated_copy.get("image_alt_text", ""))

    if description:
        word_count = count_words(description)
        if word_count < 45 or word_count > 80:
            issues.append(
                f"Description is {word_count} words; expected 45-80 words."
            )

    if len(seo_title) > 60:
        issues.append(f"SEO title is {len(seo_title)} characters; limit is 60.")

    if len(seo_meta_description) > 155:
        issues.append(
            f"SEO meta description is {len(seo_meta_description)} characters; limit is 155."
        )

    if image_alt_text and len(image_alt_text) > 125:
        issues.append(
            f"Image alt text is {len(image_alt_text)} characters; limit is 125."
        )

    banned_matches = find_banned_terms(description, banned_cliches)
    if banned_matches:
        issues.append(f"Description contains banned cliche(s): {', '.join(banned_matches)}.")

    missing_fields = [
        field
        for field in ["description", "seo_title", "seo_meta_description", "image_alt_text"]
        if not str(generated_copy.get(field, "")).strip()
    ]
    if missing_fields:
        issues.append(f"Missing generated field(s): {', '.join(missing_fields)}.")

    return issues


def build_report(items: list[dict[str, Any]], banned_cliches: list[str]) -> tuple[str, int]:
    """Create a markdown report and return the issue count."""
    lines = [
        "# Validation Report",
        "",
        f"Items checked: {len(items)}",
        f"Banned cliches: {', '.join(banned_cliches)}",
        "",
    ]

    total_issues = 0
    for item in items:
        issues = validate_item(item, banned_cliches)
        if not issues:
            continue

        total_issues += len(issues)
        lines.append(f"## {item.get('id', '?')}. {item_name(item)}")
        for issue in issues:
            lines.append(f"- {issue}")
        lines.append("")

    if total_issues == 0:
        lines.append("No validation issues found.")
    else:
        lines.insert(3, f"Issues found: {total_issues}")

    return "\n".join(lines).rstrip() + "\n", total_issues


def main() -> None:
    """Run validation, print the report, and write it to disk."""
    load_dotenv()

    parser = argparse.ArgumentParser(description="Validate generated product copy.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument(
        "--banned-cliches",
        help="Comma-separated banned terms. Overrides BANNED_CLICHES from .env.",
    )
    args = parser.parse_args()

    items = load_generated_copy(args.input)
    banned_cliches = parse_banned_cliches(args.banned_cliches)
    report, issue_count = build_report(items, banned_cliches)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report, encoding="utf-8")
    print(report)
    print(f"Wrote validation report to {args.report}")

    raise SystemExit(1 if issue_count else 0)


if __name__ == "__main__":
    main()

