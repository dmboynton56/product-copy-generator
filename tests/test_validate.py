"""Tests for deterministic validation rules."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

import validate  # noqa: E402


def make_item(
    *,
    description: str = (
        "A clean wool blazer with sharp lapels, a shaped shoulder line, and a cupro lining "
        "that keeps the interior smooth against layers. The charcoal tone anchors seasonal "
        "suiting without reading heavy and pairs cleanly with denim, fine shirting, or a "
        "minimal slip dress for evening."
    ),
    seo_title: str = "Structured Wool Blazer",
    seo_meta_description: str = "Charcoal wool blazer with cupro lining and sharp lapels.",
    image_alt_text: str = "Charcoal wool blazer with sharp lapels",
    generation_error: str | None = None,
) -> dict:
    return {
        "id": 1,
        "source_product": {"name": "Structured Wool Blazer"},
        "generated_copy": {
            "description": description,
            "seo_title": seo_title,
            "seo_meta_description": seo_meta_description,
            "image_alt_text": image_alt_text,
        },
        "generation_error": generation_error,
    }


def test_valid_item_has_no_issues() -> None:
    issues = validate.validate_item(make_item(), validate.DEFAULT_BANNED_CLICHES)
    assert issues == []


def test_generation_error_is_reported() -> None:
    issues = validate.validate_item(
        make_item(generation_error="billing error"),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("Generation error" in issue for issue in issues)


def test_seo_title_length_limit() -> None:
    issues = validate.validate_item(
        make_item(seo_title="A" * 61),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("SEO title" in issue for issue in issues)


def test_seo_meta_description_length_limit() -> None:
    issues = validate.validate_item(
        make_item(seo_meta_description="A" * 156),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("SEO meta description" in issue for issue in issues)


def test_description_word_count_limits() -> None:
    short_issues = validate.validate_item(
        make_item(description="Too short."),
        validate.DEFAULT_BANNED_CLICHES,
    )
    long_issues = validate.validate_item(
        make_item(description="word " * 81),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("45-80 words" in issue for issue in short_issues)
    assert any("45-80 words" in issue for issue in long_issues)


def test_image_alt_text_length_limit() -> None:
    issues = validate.validate_item(
        make_item(image_alt_text="A" * 126),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("Image alt text" in issue for issue in issues)


def test_banned_cliche_detection() -> None:
    issues = validate.validate_item(
        make_item(description="An iconic wrap skirt with clean lines and a fluid drape through the hem for day wear."),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("banned cliche" in issue.lower() for issue in issues)


def test_missing_fields_are_reported() -> None:
    issues = validate.validate_item(
        make_item(description="", seo_title="", seo_meta_description="", image_alt_text=""),
        validate.DEFAULT_BANNED_CLICHES,
    )
    assert any("Missing generated field" in issue for issue in issues)


def test_banned_cliches_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BANNED_CLICHES", "customterm")
    banned = validate.parse_banned_cliches(None)
    assert banned == ["customterm"]


def test_banned_cliches_from_cli_override_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BANNED_CLICHES", "ignored")
    banned = validate.parse_banned_cliches("cli-term,another-term")
    assert banned == ["cli-term", "another-term"]


def test_fixture_sample_passes_validation() -> None:
    fixture_path = ROOT_DIR / "fixtures" / "generated_copy.sample.json"
    items = validate.load_generated_copy(fixture_path)
    report, issue_count = validate.build_report(items, validate.DEFAULT_BANNED_CLICHES)
    assert issue_count == 0
    assert "No validation issues found." in report
