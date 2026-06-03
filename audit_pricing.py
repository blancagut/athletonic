#!/usr/bin/env python3
"""
audit_pricing.py — Read-only US-MSRP pricing audit for products.db

Business rule: Athletonic shows US MSRP prices only, sourced from each brand's
official US/brand domain. The scraper hardcodes currency="USD" for every store
(scrapers/shopify.py), so prices pulled from AU/NZ/UK/CA stores or international
product variants were stored as USD without conversion.

This script flags suspect rows using four criteria and writes a CSV report.
It does NOT modify the database.

Criteria
  1. URL / source domain is non-US (.com.au, .co.nz, .co.uk, .ca, /en-au, etc.)
     or is on the blocked-source-domain list.
  2. Product name carries metric pack sizes (kg, large g/ml/L) typical of
     EU/AU/NZ SKUs instead of US units (lb/oz).
  3. Price is a statistical outlier vs the brand's own USD-domain median.
  4. Source domain is a blocked retailer/aggregator/foreign-market store.

Usage
  python3 audit_pricing.py
  python3 audit_pricing.py --out output/data/pricing_audit_suspects.csv
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sqlite3
import statistics
from collections import defaultdict
from urllib.parse import urlparse

from config import DB_PATH, DATA_DIR

# ── Source policy (mirrors src/source-of-truth/athletonic.mjs) ────────────────
BLOCKED_SOURCE_DOMAINS = {
    "bodyandfit.com",
    "bodyscience.com.au",
    "bodybuilding.com",
    "discount-supplements.co.uk",
    "nutritionwarehouse.com.au",
    "nzmuscle.co.nz",
    "supplementmart.com.au",
    "supplementsource.ca",
    "suppz.com",
    "swansonvitamins.com",
    "thefeed.com",
    "tigerfitness.com",
}

# Non-US ccTLD suffixes that should never source a US MSRP price.
NON_US_TLD_SUFFIXES = (
    ".com.au",
    ".co.nz",
    ".net.au",
    ".co.uk",
    ".org.uk",
    ".ca",
    ".de",
    ".fr",
    ".eu",
    ".nz",
    ".au",
)

# Locale path/handle markers that indicate an international (non-US) variant.
NON_US_LOCALE_MARKERS = (
    "/en-au",
    "/en-nz",
    "/en-gb",
    "/en-ca",
    "/en-eu",
    "/au/",
    "/nz/",
    "/uk/",
    "/eu/",
    "-eu",
    "-au",
    "-nz",
    "-uk",
)

# ── Criterion 2: metric pack-size detection ───────────────────────────────────
# Matches "1.6kg", "900 g", "500ml", "1 L" etc. US SKUs use lb/oz.
METRIC_UNIT_RE = re.compile(
    r"(?<![a-z0-9])(\d+(?:[.,]\d+)?)\s?(kg|kgs|g|gram|grams|ml|millilit|l|lit|litre|liter)(?![a-z])",
    re.IGNORECASE,
)
US_UNIT_RE = re.compile(r"(?<![a-z0-9])\d+(?:\.\d+)?\s?(lb|lbs|oz|pound|ounce)", re.IGNORECASE)


def domain_of(url: str | None) -> str:
    if not url:
        return ""
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return ""
    return host[4:] if host.startswith("www.") else host


def registrable_blocked(host: str) -> bool:
    """True if host equals or is a subdomain of any blocked domain."""
    for d in BLOCKED_SOURCE_DOMAINS:
        if host == d or host.endswith("." + d):
            return True
    return False


def metric_units(name: str | None) -> list[str]:
    """Return metric size tokens that look like non-US SKUs."""
    if not name:
        return []
    hits: list[str] = []
    for m in METRIC_UNIT_RE.finditer(name):
        value = float(m.group(1).replace(",", "."))
        unit = m.group(2).lower()
        # Ignore small gram/ml counts common to US labels (e.g. "5g creatine").
        if unit.startswith("g") and value < 400:
            continue
        if unit.startswith("ml") and value < 400:
            continue
        hits.append(m.group(0).strip())
    return hits


def main() -> int:
    ap = argparse.ArgumentParser(description="US-MSRP pricing audit (read-only).")
    ap.add_argument(
        "--out",
        default=os.path.join(DATA_DIR, "pricing_audit_suspects.csv"),
        help="CSV output path for suspect rows.",
    )
    ap.add_argument(
        "--outlier-pct",
        type=float,
        default=40.0,
        help="Criterion 3 deviation threshold vs brand median (percent).",
    )
    args = ap.parse_args()

    if not os.path.exists(DB_PATH):
        print(f"ERROR: database not found at {DB_PATH}")
        return 1

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT brand, product_id, name, url, price, currency, available
        FROM products
        """
    ).fetchall()
    conn.close()

    # Brand medians from US-domain, priced rows only (clean baseline).
    brand_prices: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        price = r["price"]
        host = domain_of(r["url"])
        clean_us = host and not host.endswith(NON_US_TLD_SUFFIXES) and not registrable_blocked(host)
        if clean_us and price and price > 0:
            brand_prices[r["brand"]].append(float(price))

    brand_median: dict[str, float] = {
        b: statistics.median(p) for b, p in brand_prices.items() if len(p) >= 5
    }

    suspects: list[dict] = []
    for r in rows:
        brand = r["brand"]
        pid = r["product_id"]
        name = r["name"] or ""
        url = r["url"] or ""
        price = r["price"]
        host = domain_of(url)
        url_low = url.lower()

        reasons: list[str] = []
        severity = "low"

        # Criterion 4: blocked retailer/aggregator/foreign-market domain.
        if host and registrable_blocked(host):
            reasons.append(f"blocked_domain:{host}")
            severity = "high"

        # Criterion 1: non-US ccTLD.
        if host and host.endswith(NON_US_TLD_SUFFIXES):
            reasons.append(f"non_us_tld:{host}")
            severity = "high"

        # Criterion 1: non-US locale marker in URL/handle.
        loc = next((m for m in NON_US_LOCALE_MARKERS if m in url_low), None)
        if loc:
            reasons.append(f"non_us_locale:{loc}")
            if severity != "high":
                severity = "medium"

        # Criterion 2: metric pack size (and no US unit present).
        mu = metric_units(name)
        if mu and not US_UNIT_RE.search(name):
            reasons.append("metric_units:" + "|".join(mu))
            if severity == "low":
                severity = "medium"

        # Criterion 3: price outlier vs brand median.
        med = brand_median.get(brand)
        if med and price and price > 0:
            dev = abs(float(price) - med) / med * 100.0
            if dev >= args.outlier_pct:
                reasons.append(f"price_outlier:{price:.2f}_vs_median{med:.2f}_({dev:.0f}%)")
                if severity == "low":
                    severity = "medium"

        if reasons:
            suspects.append(
                {
                    "brand": brand,
                    "product_id": pid,
                    "name": name,
                    "url": url,
                    "domain": host,
                    "price": price,
                    "currency": r["currency"],
                    "available": r["available"],
                    "severity": severity,
                    "reasons": "; ".join(reasons),
                }
            )

    # Sort: high severity first, then by brand.
    sev_rank = {"high": 0, "medium": 1, "low": 2}
    suspects.sort(key=lambda s: (sev_rank[s["severity"]], s["brand"], s["product_id"]))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    fields = [
        "brand",
        "product_id",
        "name",
        "url",
        "domain",
        "price",
        "currency",
        "available",
        "severity",
        "reasons",
    ]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(suspects)

    # Console summary.
    by_sev: dict[str, int] = defaultdict(int)
    by_brand: dict[str, int] = defaultdict(int)
    for s in suspects:
        by_sev[s["severity"]] += 1
        by_brand[s["brand"]] += 1

    print(f"Scanned {len(rows)} products.")
    print(f"Flagged {len(suspects)} suspects "
          f"(high={by_sev['high']} medium={by_sev['medium']} low={by_sev['low']}).")
    print("\nTop 20 brands by suspect count:")
    for b, c in sorted(by_brand.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {c:6d}  {b}")
    print(f"\nReport written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
