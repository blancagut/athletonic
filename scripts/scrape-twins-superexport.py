#!/usr/bin/env python3
"""Rebuild Twins Special products in data/wholesale-muay-thai-catalog.json from
superexportshop.org (bestsellers collection, vendor "Twins Special").

Pricing: THB -> USD at 33.24 THB/USD, +28%, then rounded UP to the next
.49/.99 ending (owner-favorable psychological price).
Run: python3 scripts/scrape-twins-superexport.py
"""
import json
import subprocess

THB_PER_USD = 33.24
MARKUP = 1.28
SOURCE = "https://superexportshop.org/collections/bestsellers/products.json?limit=250&page={page}"
MANIFEST = "data/wholesale-muay-thai-catalog.json"
SNAPSHOT = "data/twins-superexport-products.json"

CATEGORY_MAP = {
    "boxing gloves": "Training Gloves",
    "bag gloves": "Bag Gloves",
    "mma gloves": "MMA & Grappling Gloves",
    "shinguards": "Shin Guards",
    "ankleguards": "Ankle & Elbow Supports",
    "elbow pads": "Ankle & Elbow Supports",
    "handwraps": "Hand Wraps & Tape",
    "mouthguard": "Mouthguards",
    "shorts": "Shorts",
    "sauna suit": "Training Gear",
    "jump rope": "Jump Ropes",
    "key chain": "Training Gear",
    "groin protector": "Groin Protectors",
    "t-shirt": "Training Gear",
    "gym bag": "Gym Bag",
    "headguards": "Headgear",
    "belly pad": "Belly Pads",
    "pads": "Thai Pads & Kick Pads",
    "donut pads": "Thai Pads & Kick Pads",
    "wall unit": "Thai Pads & Kick Pads",
    "focus mitts": "Focus Mitts",
    "body protector": "Belly Pads",
}


def owner_round_cents(value_usd):
    """Round up to the next price ending in .49 or .99."""
    cents = int(round(value_usd * 100))
    dollars, rem = divmod(cents, 100)
    return dollars * 100 + (49 if rem <= 49 else 99)


def price_cents_from_thb(thb):
    usd = round(thb / THB_PER_USD, 2)
    marked = round(usd * MARKUP, 2)
    return owner_round_cents(marked)


def fetch_all():
    products, page = [], 1
    while True:
        out = subprocess.run(
            ["curl", "-sf", "--max-time", "60", "-A", "Mozilla/5.0", SOURCE.format(page=page)],
            capture_output=True, check=True,
        ).stdout
        batch = json.loads(out).get("products", [])
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 250:
            break
        page += 1
    return products


def normalize_sizes(values, product_type):
    """Bare numeric glove sizes from the shop ("8", "10") -> "8oz" etc."""
    if str(product_type).strip().lower() not in ("boxing gloves", "bag gloves", "mma gloves"):
        return values
    return [f"{v}oz" if v.isdigit() else v for v in values]


def to_manifest_row(product):
    variants = product.get("variants", [])
    prices_thb = [float(v["price"]) for v in variants if v.get("price")]
    min_thb = min(prices_thb) if prices_thb else None
    sizes, colors, other = [], [], []
    for option in product.get("options", []):
        name = str(option.get("name", "")).strip().lower()
        values = [str(v).strip() for v in option.get("values", []) if str(v).strip()]
        if name == "size":
            sizes = normalize_sizes(values, product.get("product_type", ""))
        elif name == "color":
            colors = values
        elif name not in ("title",):
            other.extend(values)
    image = (product.get("images") or [{}])[0]
    available = any(v.get("available") for v in variants)
    category = CATEGORY_MAP.get(str(product.get("product_type", "")).strip().lower(), "Training Gear")
    return {
        "id": f"official-twins-{product['handle']}",
        "brand_slug": "twins_special",
        "brand": "Twins Special",
        "name": str(product.get("title", "")).strip(),
        "url": None,
        "image_url": image.get("src") or None,
        "image_width": image.get("width") or None,
        "image_height": image.get("height") or None,
        "category_slug": None,
        "category_label": category,
        "product_type": str(product.get("product_type", "")).strip() or category,
        "brand_origin": "Thailand",
        "catalog_visibility": "wholesale",
        "quote_enabled": True,
        "available": available,
        "availability_status": "Available" if available else "Out of stock",
        "retail_price_cents": price_cents_from_thb(min_thb) if min_thb else None,
        "sizes": sizes,
        "colors": colors,
        "other_options": other,
        "variant_count": len(variants),
        "source_price_thb": min_thb,
    }


def main():
    raw = fetch_all()
    seen = set()
    twins = []
    for product in raw:
        if product.get("vendor") != "Twins Special":
            continue
        if product["handle"] in seen:
            continue
        seen.add(product["handle"])
        twins.append(to_manifest_row(product))

    with open(SNAPSHOT, "w") as f:
        json.dump({"source": "superexportshop.org bestsellers", "thb_per_usd": THB_PER_USD, "markup": MARKUP, "products": twins}, f, indent=1)

    manifest = json.load(open(MANIFEST))
    kept = [p for p in manifest["products"] if p.get("brand_slug") != "twins_special"]
    manifest["products"] = kept + [{k: v for k, v in row.items() if k != "source_price_thb"} for row in twins]
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=1)

    priced = sum(1 for t in twins if t["retail_price_cents"])
    print(f"twins scraped: {len(twins)} ({priced} priced), manifest total: {len(manifest['products'])}")


if __name__ == "__main__":
    main()
