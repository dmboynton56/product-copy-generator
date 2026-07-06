"""Helpers for turning Anthropic API exceptions into readable messages."""

from __future__ import annotations

from typing import Any


def format_api_error(exc: BaseException) -> str:
    """Return a short, human-readable summary of an Anthropic API error."""
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__

    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            error_type = error.get("type")
            error_message = error.get("message")
            if error_type and error_message:
                return f"{error_type}: {error_message}"
            if error_message:
                return str(error_message)

    lowered = message.lower()
    if "credit balance" in lowered or "billing" in lowered:
        return "Anthropic billing error: credit balance too low to run this request."
    if "authentication" in lowered or "invalid api key" in lowered:
        return "Anthropic authentication error: check ANTHROPIC_API_KEY."
    if "rate limit" in lowered:
        return "Anthropic rate limit exceeded: retry after a short delay."

    if len(message) > 240:
        return message[:237] + "..."

    return message
