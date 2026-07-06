#!/usr/bin/env python3
"""Export a KHAITE catalog subset for Claude agent analysis.

This uses KHAITE/Shopify's public read-only collection JSON endpoints listed in
https://khaite.com/agents.md. It does not touch cart or checkout endpoints.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import statistics
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT_DIR / "data" / "scraped"
DEFAULT_COLLECTION_HANDLES = [
    "new",
    "ready-to-wear",
    "handbags",
    "shoes",
    "accessories",
    "denim",
    "dresses",
    "sale",
]

USER_AGENT = "Mozilla/5.0 (compatible; product-copy-generator-catalog-research/1.0)"
BASE_URL = "https://khaite.com"

MATERIAL_WEIGHTS = {
    "python": 25,
    "exotic": 22,
    "calfskin": 20,
    "lambskin": 20,
    "leather": 18,
    "suede": 18,
    "cashmere": 18,
    "shearling": 17,
    "silk": 14,
    "wool": 12,
    "raffia": 10,
    "denim": 9,
    "cotton": 8,
    "linen": 8,
    "lyocell": 6,
    "viscose": 5,
}


@dataclass
class ExportConfig:
    collection_handles: list[str]
    limit_per_collection: int
    delay_seconds: float
    output_stem: str


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def strip_html(value: str | None) -> str:
    if not value:
        return ""

    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"</p\s*>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def money_to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None

    try:
        return round(float(str(value).replace("$", "").replace(",", "")), 2)
    except ValueError:
        return None


def split_tags(tags: Any) -> list[str]:
    if isinstance(tags, list):
        return [str(tag).strip() for tag in tags if str(tag).strip()]
    if isinstance(tags, str):
        return [tag.strip() for tag in tags.split(",") if tag.strip()]
    return []


def normalize_material_text(raw: str | None) -> str:
    if not raw:
        return ""

    value = raw.replace("/", " ").replace("_", " ")
    value = re.sub(r"(\d+)%?([A-Z]+)", r"\1% \2", value)
    value = value.replace(",", ", ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def material_keywords(product: dict[str, Any]) -> list[str]:
    first_variant = (product.get("variants") or [{}])[0]
    haystack = " ".join(
        [
            str(product.get("title") or ""),
            str(product.get("body_html") or ""),
            str(product.get("product_type") or ""),
            " ".join(split_tags(product.get("tags"))),
            str(first_variant.get("option3") or ""),
        ]
    ).lower()

    return sorted([keyword for keyword in MATERIAL_WEIGHTS if keyword in haystack])


def product_color(product: dict[str, Any]) -> str:
    first_variant = (product.get("variants") or [{}])[0]
    option_color = str(first_variant.get("option2") or "").strip()
    if option_color:
        return option_color

    for tag in split_tags(product.get("tags")):
        if tag.lower().startswith("color:"):
            return tag.split(":", 1)[1].strip()

    match = re.search(r"\bin\s+(.+)$", str(product.get("title") or ""), flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def product_sizes(product: dict[str, Any]) -> tuple[list[str], list[str], list[str]]:
    sizes: list[str] = []
    available: list[str] = []
    unavailable: list[str] = []

    for variant in product.get("variants") or []:
        size = str(variant.get("option1") or "").strip()
        if not size or size in sizes:
            continue
        sizes.append(size)
        if variant.get("available"):
            available.append(size)
        else:
            unavailable.append(size)

    return sizes, available, unavailable


def product_prices(product: dict[str, Any]) -> tuple[float | None, float | None, float | None]:
    prices = [money_to_float(variant.get("price")) for variant in product.get("variants") or []]
    prices = [price for price in prices if price is not None]

    compare_prices = [
        money_to_float(variant.get("compare_at_price")) for variant in product.get("variants") or []
    ]
    compare_prices = [price for price in compare_prices if price is not None]

    price = min(prices) if prices else None
    compare_at = max(compare_prices) if compare_prices else None
    markdown = None
    if price is not None and compare_at and compare_at > price:
        markdown = round((compare_at - price) / compare_at * 100, 1)

    return price, compare_at, markdown


def collection_products(handle: str, limit: int) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"limit": limit})
    url = f"{BASE_URL}/collections/{handle}/products.json?{query}"
    payload = fetch_json(url)
    products = payload.get("products")
    if not isinstance(products, list):
        raise ValueError(f"Unexpected products payload for collection '{handle}'")
    return products


def collect_products(config: ExportConfig) -> dict[int, dict[str, Any]]:
    products_by_id: dict[int, dict[str, Any]] = {}

    for handle in config.collection_handles:
        products = collection_products(handle, config.limit_per_collection)
        print(f"{handle}: {len(products)} products")

        for position, product in enumerate(products, start=1):
            product_id = int(product["id"])
            existing = products_by_id.setdefault(product_id, product)
            collection_hits = existing.setdefault("_collection_hits", [])
            collection_hits.append(
                {
                    "handle": handle,
                    "url": f"{BASE_URL}/collections/{handle}",
                    "position": position,
                }
            )

        time.sleep(config.delay_seconds)

    return products_by_id


def base_product_row(product: dict[str, Any], retrieved_at: str) -> dict[str, Any]:
    tags = split_tags(product.get("tags"))
    lower_tags = [tag.lower() for tag in tags]
    variants = product.get("variants") or []
    sizes, available_sizes, unavailable_sizes = product_sizes(product)
    price, compare_at, markdown = product_prices(product)
    materials = normalize_material_text((variants[0] if variants else {}).get("option3"))
    keywords = material_keywords(product)
    available_count = sum(1 for variant in variants if variant.get("available"))
    variant_count = len(variants)
    collection_hits = product.get("_collection_hits") or []
    collection_handles = [hit["handle"] for hit in collection_hits]

    return {
        "product_id": product.get("id"),
        "title": product.get("title") or "",
        "handle": product.get("handle") or "",
        "source_url": f"{BASE_URL}/products/{product.get('handle')}",
        "product_type": product.get("product_type") or "",
        "vendor": product.get("vendor") or "",
        "description": strip_html(product.get("body_html")),
        "price_usd": price,
        "compare_at_price_usd": compare_at,
        "markdown_percent": markdown,
        "color": product_color(product),
        "materials_raw": materials,
        "material_keywords": keywords,
        "sku": (variants[0] if variants else {}).get("sku") or "",
        "variant_count": variant_count,
        "available_variant_count": available_count,
        "sold_out_variant_count": max(variant_count - available_count, 0),
        "availability_ratio": round(available_count / variant_count, 3) if variant_count else None,
        "is_sold_out": available_count == 0 if variant_count else None,
        "sizes": sizes,
        "available_sizes": available_sizes,
        "unavailable_sizes": unavailable_sizes,
        "image_count": len(product.get("images") or []),
        "featured_image_url": ((product.get("images") or [{}])[0].get("src") or ""),
        "published_at": product.get("published_at") or "",
        "created_at": product.get("created_at") or "",
        "updated_at": product.get("updated_at") or "",
        "tags": tags,
        "collection_handles": collection_handles,
        "collection_urls": [hit["url"] for hit in collection_hits],
        "best_collection_position": min((hit["position"] for hit in collection_hits), default=None),
        "is_new": "new" in collection_handles or "new" in lower_tags,
        "is_sale": "sale" in collection_handles or "sale" in lower_tags,
        "is_best_seller": any("best seller" in tag for tag in lower_tags),
        "retrieved_at": retrieved_at,
    }


def add_scores(rows: list[dict[str, Any]]) -> None:
    prices_by_type: dict[str, list[float]] = {}
    for row in rows:
        if row["price_usd"] is None:
            continue
        prices_by_type.setdefault(row["product_type"] or "Unknown", []).append(float(row["price_usd"]))

    medians = {
        product_type: statistics.median(prices)
        for product_type, prices in prices_by_type.items()
        if prices
    }

    for row in rows:
        price = row["price_usd"]
        product_type = row["product_type"] or "Unknown"
        median_price = medians.get(product_type)
        row["category_median_price_usd"] = round(median_price, 2) if median_price is not None else None

        if price is not None and median_price:
            row["price_vs_category_median_pct"] = round((price - median_price) / median_price * 100, 1)
            if price <= median_price:
                price_score = 60 + min(30, (median_price - price) / median_price * 60)
            else:
                price_score = 60 - min(45, (price - median_price) / median_price * 45)
        else:
            row["price_vs_category_median_pct"] = None
            price_score = 45

        material_score = min(
            sum(MATERIAL_WEIGHTS[keyword] for keyword in row["material_keywords"]),
            35,
        )
        markdown_score = min(float(row["markdown_percent"] or 0) * 2, 100)
        availability_score = 0 if row["is_sold_out"] else 75
        material_normalized = material_score / 35 * 100 if material_score else 0

        row["material_signal_score"] = round(material_normalized)
        row["value_proxy_score"] = round(
            max(
                0,
                min(
                    100,
                    price_score * 0.55
                    + material_normalized * 0.25
                    + markdown_score * 0.15
                    + availability_score * 0.05,
                ),
            )
        )

        availability_ratio = row["availability_ratio"]
        scarcity_score = 0
        if isinstance(availability_ratio, (float, int)):
            scarcity_score = max(0, min(25, (1 - float(availability_ratio)) * 25))

        collection_score = min(len(set(row["collection_handles"])) * 4, 16)
        row["popularity_proxy_score"] = round(
            max(
                0,
                min(
                    100,
                    (25 if row["is_best_seller"] else 0)
                    + (15 if row["is_new"] else 0)
                    + (8 if row["is_sale"] else 0)
                    + collection_score
                    + scarcity_score
                    + min(row["image_count"], 6)
                    + (6 if row["available_variant_count"] > 0 else 0),
                ),
            )
        )

        row["proxy_score_notes"] = (
            "Heuristic only: popularity uses best-seller/new/sale tags, collection presence, "
            "variant scarcity, image count, and availability. It is not actual sales or traffic."
        )


def csv_value(value: Any) -> Any:
    if isinstance(value, list):
        return "|".join(str(item) for item in value)
    return value


def write_outputs(rows: list[dict[str, Any]], config: ExportConfig, retrieved_at: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    metadata = {
        "retrieved_at": retrieved_at,
        "source": "KHAITE public Shopify JSON endpoints",
        "source_docs": [
            "https://khaite.com/agents.md",
            "https://khaite.com/robots.txt",
        ],
        "collection_handles": config.collection_handles,
        "limit_per_collection": config.limit_per_collection,
        "product_count": len(rows),
        "limitations": [
            "Popularity is a proxy, not actual sales, traffic, or conversion data.",
            "Value is a category-relative heuristic using price, material keywords, markdowns, and availability.",
            "The export is a bounded public catalog sample, not the complete KHAITE catalog.",
        ],
    }

    json_path = OUTPUT_DIR / f"{config.output_stem}.json"
    csv_path = OUTPUT_DIR / f"{config.output_stem}.csv"

    json_path.write_text(
        json.dumps({"metadata": metadata, "products": rows}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    columns = [
        "product_id",
        "title",
        "source_url",
        "product_type",
        "price_usd",
        "compare_at_price_usd",
        "markdown_percent",
        "category_median_price_usd",
        "price_vs_category_median_pct",
        "value_proxy_score",
        "popularity_proxy_score",
        "material_signal_score",
        "color",
        "materials_raw",
        "material_keywords",
        "sku",
        "variant_count",
        "available_variant_count",
        "sold_out_variant_count",
        "availability_ratio",
        "is_sold_out",
        "sizes",
        "available_sizes",
        "unavailable_sizes",
        "image_count",
        "featured_image_url",
        "is_new",
        "is_sale",
        "is_best_seller",
        "collection_handles",
        "best_collection_position",
        "published_at",
        "updated_at",
        "description",
        "tags",
        "proxy_score_notes",
    ]

    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: csv_value(row.get(column)) for column in columns})

    print(f"Wrote {len(rows)} products")
    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")


def parse_args() -> ExportConfig:
    parser = argparse.ArgumentParser(description="Export KHAITE catalog data for Claude agent analysis.")
    parser.add_argument(
        "--collections",
        default=",".join(DEFAULT_COLLECTION_HANDLES),
        help="Comma-separated collection handles.",
    )
    parser.add_argument("--limit-per-collection", type=int, default=18)
    parser.add_argument("--delay-seconds", type=float, default=0.25)
    parser.add_argument("--output-stem", default="khaite_agent_catalog_sample")
    args = parser.parse_args()

    collection_handles = [handle.strip() for handle in args.collections.split(",") if handle.strip()]
    if not collection_handles:
        raise SystemExit("At least one collection handle is required.")

    return ExportConfig(
        collection_handles=collection_handles,
        limit_per_collection=args.limit_per_collection,
        delay_seconds=args.delay_seconds,
        output_stem=args.output_stem,
    )


def main() -> None:
    config = parse_args()
    retrieved_at = datetime.now(timezone.utc).isoformat()
    products_by_id = collect_products(config)

    rows = [base_product_row(product, retrieved_at) for product in products_by_id.values()]
    rows.sort(key=lambda row: (row["product_type"], row["price_usd"] or 0, row["title"]))
    add_scores(rows)
    rows.sort(
        key=lambda row: (
            -(row["popularity_proxy_score"] or 0),
            -(row["value_proxy_score"] or 0),
            row["product_type"],
            row["title"],
        )
    )

    write_outputs(rows, config, retrieved_at)


if __name__ == "__main__":
    main()
