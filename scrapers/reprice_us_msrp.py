#!/usr/bin/env python3
"""
US MSRP repricing pass for output/data/products.db.

WHY
  Many multi-variant products have a single identical price (or all zeros)
  across every size, so the PDP price never changes when the shopper picks a
  different size. The generator logic is already correct: it builds
  `variantPricing` from the variants table and swaps the displayed price on
  option change. The defect is in the DATA — variants.price does not hold the
  real per-size price.

WHAT THIS DOES
  For each eligible product it re-fetches the product's OWN US storefront
  Shopify endpoint ({products.url}.json) and reads the real per-variant US MSRP
  (variants[].price / compare_at_price), then UPSERTs:
    * variants.price, variants.compare_at_price        (matched by variant_id)
    * products.price / compare_at_price ONLY when the stored base price is <= 0
      (so existing, already-correct base prices — and therefore homepage cards,
      deals and index.html — stay byte-identical).
  It NEVER touches images, options, availability, categories or any other field.

STRICT US-ONLY RULE
  Only products with currency='USD' AND a US-safe URL are processed. Any URL on
  a non-US ccTLD (.com.au/.net.au/.co.nz/.nz/.co.uk/.org.uk/.ca/.de/.fr/.eu) is
  skipped and reported — never currency-converted.

SAFETY
  * Dry-run by default. Pass --apply to write to the DB.
  * Idempotent, batched commits, rate-limited, resumable via a state file.
  * node/JS generator is untouched; run `npm run generate` afterwards.

USAGE
  python3 scrapers/reprice_us_msrp.py                 # dry-run, default sample
  python3 scrapers/reprice_us_msrp.py --ids 1535      # dry-run a specific id
  python3 scrapers/reprice_us_msrp.py --limit 25      # dry-run 25 eligible
  python3 scrapers/reprice_us_msrp.py --brand optimum_nutrition --limit 10
  python3 scrapers/reprice_us_msrp.py --apply         # WRITE (full eligible set)
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from urllib.parse import urlsplit, urlunsplit

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB_PATH = os.path.join(ROOT, "output", "data", "products.db")
STATE_PATH = os.path.join(ROOT, "output", "logs", "reprice_us_msrp_state.json")

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Non-US ccTLDs whose prices must NEVER be used as US MSRP.
NON_US_SUFFIXES = (
    ".com.au", ".net.au", ".co.nz", ".nz", ".au",
    ".co.uk", ".org.uk", ".uk",
    ".ca", ".de", ".fr", ".eu",
)


def is_us_safe(url: str | None) -> bool:
    if not url:
        return False
    host = urlsplit(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return not any(host.endswith(sfx) for sfx in NON_US_SUFFIXES)


def product_json_url(url: str) -> str | None:
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    if not path:
        return None
    if not path.endswith(".json"):
        path = path + ".json"
    # Drop any query/fragment; we only want the canonical product JSON.
    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


def to_float(value) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def select_eligible(conn: sqlite3.Connection, args) -> list[sqlite3.Row]:
    """Products whose variants need per-size US MSRP repricing."""
    where = [
        "p.url LIKE 'http%'",
        "COALESCE(p.currency,'USD') = 'USD'",
        "COALESCE(p.excluded,0) = 0",
    ]
    params: list = []
    if args.brand:
        where.append("p.brand = ?")
        params.append(args.brand)
    if args.ids:
        ids = [int(x) for x in args.ids.split(",") if x.strip()]
        placeholders = ",".join("?" for _ in ids)
        where.append(f"p.id IN ({placeholders})")
        params.extend(ids)

    sql = f"""
        WITH v AS (
            SELECT product_row_id,
                   COUNT(*) n,
                   SUM(CASE WHEN COALESCE(price,0) > 0 THEN 1 ELSE 0 END) np,
                   COUNT(DISTINCT CASE WHEN COALESCE(price,0) > 0 THEN price END) ndp
            FROM variants GROUP BY product_row_id
        )
        SELECT p.id, p.brand, p.product_id, p.name, p.url, p.price,
               p.compare_at_price, p.currency, v.n, v.np, v.ndp
        FROM products p
        JOIN v ON v.product_row_id = p.id
        WHERE {' AND '.join(where)}
    """
    # Eligibility (when not targeting explicit ids).
    if not args.ids:
        if args.targeted:
            # High-precision defect set: products whose variants are ALL zero,
            # OR multi-variant single-price products whose option values look
            # like weight/serving tiers (which SHOULD vary in price). This
            # deliberately excludes apparel/clothing sizes (XS/S/M/L) and
            # flavor-only products, which legitimately share one price.
            sql += (
                " AND ("
                "   v.np = 0"
                "   OR (v.n > 1 AND v.ndp <= 1 AND v.product_row_id IN ("
                "        SELECT product_row_id FROM variants WHERE "
                "          option1 GLOB '*[0-9]* lb*' OR option2 GLOB '*[0-9]* lb*' OR"
                "          option1 GLOB '*[0-9]*lb*'  OR option2 GLOB '*[0-9]*lb*'  OR"
                "          option1 LIKE '%serving%' OR option2 LIKE '%serving%' OR"
                "          option1 LIKE '%count%' OR option2 LIKE '%count%' OR"
                "          option1 LIKE '%capsule%' OR option2 LIKE '%capsule%' OR"
                "          option1 LIKE '%tablet%' OR option2 LIKE '%tablet%' OR"
                "          option1 LIKE '%softgel%' OR option2 LIKE '%softgel%' OR"
                "          option1 LIKE '%gumm%' OR option2 LIKE '%gumm%' OR"
                "          option1 GLOB '*[0-9]* oz*' OR option2 GLOB '*[0-9]* oz*' OR"
                "          option1 GLOB '*[0-9]* g*' OR option2 GLOB '*[0-9]* g*' OR"
                "          option1 GLOB '*[0-9]* kg*' OR option2 GLOB '*[0-9]* kg*' OR"
                "          option1 GLOB '*[0-9]* ml*' OR option2 GLOB '*[0-9]* ml*' OR"
                "          option1 LIKE '%pack%' OR option2 LIKE '%pack%'"
                "      ))"
                " )"
            )
        else:
            # Broad: any multi-variant all-zero or single-price product.
            sql += " AND v.n > 1 AND (v.np = 0 OR v.ndp <= 1)"
    sql += " ORDER BY p.id ASC"
    if args.limit and not args.ids:
        sql += f" LIMIT {int(args.limit)}"
    return conn.execute(sql, params).fetchall()


def fetch_variant_prices(session: requests.Session, url: str, timeout: int):
    """Return {variant_id: {'price':..,'compare_at':..}} from the US .json."""
    json_url = product_json_url(url)
    if not json_url:
        return None, "no_json_url"
    if not is_us_safe(json_url):
        return None, "non_us_url"
    try:
        resp = session.get(json_url, timeout=timeout)
    except requests.RequestException as exc:
        return None, f"request_error:{type(exc).__name__}"
    if resp.status_code == 404:
        return None, "http_404"
    if resp.status_code == 429:
        return None, "http_429"
    if resp.status_code >= 400:
        return None, f"http_{resp.status_code}"
    try:
        data = resp.json()
    except ValueError:
        return None, "not_json"
    product = (data or {}).get("product")
    if not isinstance(product, dict):
        return None, "no_product"
    variants = product.get("variants")
    if not isinstance(variants, list) or not variants:
        return None, "no_variants"
    out = {}
    for var in variants:
        vid = str(var.get("id") or "").strip()
        if not vid:
            continue
        out[vid] = {
            "price": to_float(var.get("price")),
            "compare_at": to_float(var.get("compare_at_price")),
        }
    if not out:
        return None, "empty_variant_map"
    return out, "ok"


def load_state() -> set[int]:
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as fh:
            return set(json.load(fh).get("done", []))
    except (OSError, ValueError):
        return set()


def save_state(done: set[int]) -> None:
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"done": sorted(done)}, fh)
    os.replace(tmp, STATE_PATH)


def main() -> int:
    ap = argparse.ArgumentParser(description="US MSRP repricing pass")
    ap.add_argument("--apply", action="store_true", help="write to the DB (default: dry-run)")
    ap.add_argument("--brand", help="restrict to one brand slug")
    ap.add_argument("--ids", help="comma-separated product ids (overrides eligibility filter)")
    ap.add_argument("--limit", type=int, default=15, help="max eligible products (dry-run default 15)")
    ap.add_argument("--targeted", action="store_true", help="restrict to all-zero + weight/serving single-price defects")
    ap.add_argument("--delay", type=float, default=0.7, help="seconds between requests")
    ap.add_argument("--timeout", type=int, default=20, help="HTTP timeout seconds")
    ap.add_argument("--commit-every", type=int, default=200, help="commit batch size when applying")
    ap.add_argument("--resume", action="store_true", help="skip product ids already processed in state file")
    ap.add_argument("--show", type=int, default=12, help="rows to print in dry-run before/after table")
    args = ap.parse_args()

    if not os.path.exists(DB_PATH):
        print(f"DB not found: {DB_PATH}", file=sys.stderr)
        return 2

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = select_eligible(conn, args)
    done = load_state() if args.resume else set()
    if done:
        rows = [r for r in rows if r["id"] not in done]

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})

    stats = {
        "eligible": len(rows),
        "fetched_ok": 0,
        "variants_updated": 0,
        "products_base_filled": 0,
        "skipped_non_us": 0,
        "skipped_no_data": 0,
        "unchanged": 0,
    }
    skip_reasons: dict[str, int] = {}
    sample_rows: list[tuple] = []
    pending = 0

    for idx, prod in enumerate(rows, 1):
        pid = prod["id"]
        price_map, reason = fetch_variant_prices(session, prod["url"], args.timeout)
        if price_map is None:
            if reason == "non_us_url":
                stats["skipped_non_us"] += 1
            else:
                stats["skipped_no_data"] += 1
            skip_reasons[reason] = skip_reasons.get(reason, 0) + 1
            if args.delay:
                time.sleep(args.delay)
            continue

        stats["fetched_ok"] += 1
        db_variants = conn.execute(
            "SELECT id, variant_id, title, option1, option2, option3, price, compare_at_price "
            "FROM variants WHERE product_row_id = ? ORDER BY id",
            (pid,),
        ).fetchall()

        new_prices = []
        changed_here = 0
        for dv in db_variants:
            live = price_map.get(str(dv["variant_id"]))
            if not live or live["price"] <= 0:
                continue
            new_price = round(live["price"], 2)
            new_cmp = round(live["compare_at"], 2)
            new_prices.append(new_price)
            old_price = to_float(dv["price"])
            old_cmp = to_float(dv["compare_at_price"])
            if abs(new_price - old_price) > 0.005 or abs(new_cmp - old_cmp) > 0.005:
                changed_here += 1
                if args.apply:
                    conn.execute(
                        "UPDATE variants SET price = ?, compare_at_price = ? WHERE id = ?",
                        (new_price, new_cmp if new_cmp > 0 else None, dv["id"]),
                    )
                if len(sample_rows) < args.show:
                    label = (dv["title"] or " / ".join(
                        x for x in (dv["option1"], dv["option2"], dv["option3"]) if x
                    ))
                    sample_rows.append((pid, prod["brand"], label, old_price, new_price))

        stats["variants_updated"] += changed_here
        if changed_here == 0:
            stats["unchanged"] += 1

        # Fill base price ONLY when it is currently broken (<= 0), to avoid
        # disturbing existing good base prices (and therefore homepage/deals).
        if new_prices and to_float(prod["price"]) <= 0:
            base = min(new_prices)
            stats["products_base_filled"] += 1
            if args.apply:
                conn.execute("UPDATE products SET price = ? WHERE id = ?", (base, pid))

        pending += 1
        done.add(pid)
        if args.apply and pending >= args.commit_every:
            conn.commit()
            save_state(done)
            pending = 0
            print(f"  …committed through product {pid} ({idx}/{len(rows)})", flush=True)

        if args.delay:
            time.sleep(args.delay)

    if args.apply:
        conn.commit()
        save_state(done)
    conn.close()

    mode = "APPLY (DB WRITTEN)" if args.apply else "DRY-RUN (no DB writes)"
    print("\n==================== REPRICE US MSRP — " + mode + " ====================")
    for key, val in stats.items():
        print(f"  {key:24s} {val}")
    if skip_reasons:
        print("  skip_reasons:")
        for reason, cnt in sorted(skip_reasons.items(), key=lambda kv: -kv[1]):
            print(f"      {reason:24s} {cnt}")
    if sample_rows:
        print("\n  Sample variant price changes (id | brand | variant | old -> new USD):")
        for pid, brand, label, old, new in sample_rows:
            print(f"    {pid:>6} | {brand:<18} | {label:<32} | {old:>8.2f} -> {new:>8.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
