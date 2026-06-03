from __future__ import annotations

import argparse
import asyncio
import json
import re
import sqlite3
import ssl
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import aiohttp
import certifi

ROOT_DB = "output/data/products.db"
SOURCE_OF_TRUTH_PATH = "src/source-of-truth/athletonic.mjs"

if __name__ == "__main__" and __package__ is None:
    import os

    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)

from config import BRANDS

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}

LD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)


@dataclass
class TargetRow:
    row_id: int
    brand: str
    product_id: str
    name: str
    url: str


def _brand_host_map() -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)

    # Base URL mapping from scraper config.
    for slug, meta in BRANDS.items():
        base_url = str(meta.get("base_url") or "").strip()
        if not base_url:
            continue
        host = urlparse(base_url).netloc.lower().replace("www.", "")
        if host:
            out[slug].add(host)

    # Official domains from source-of-truth file.
    sot = Path(SOURCE_OF_TRUTH_PATH)
    if sot.exists():
        content = sot.read_text(encoding="utf-8", errors="ignore")
        pattern = re.compile(
            r"\{\s*slug:\s*\"(?P<slug>[^\"]+)\".*?officialDomains:\s*\[(?P<domains>[^\]]*)\]",
            re.DOTALL,
        )
        for m in pattern.finditer(content):
            slug = m.group("slug").strip()
            domains = re.findall(r'\"([^\"]+)\"', m.group("domains"))
            for d in domains:
                cleaned = d.strip().lower().replace("www.", "")
                if cleaned:
                    out[slug].add(cleaned)

    return dict(out)


def _is_official_domain(brand: str, url: str, host_map: dict[str, set[str]]) -> bool:
    expected_hosts = host_map.get(brand) or set()
    if not expected_hosts:
        return False

    host = urlparse(url).netloc.lower().replace("www.", "")
    for expected in expected_hosts:
        if host == expected or host.endswith("." + expected):
            return True
    return False


def _find_product_ld(html: str) -> dict[str, Any] | None:
    for raw in LD_RE.findall(html):
        try:
            data = json.loads(raw.strip())
        except Exception:
            cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
            cleaned = "".join(ch for ch in cleaned if ord(ch) >= 0x20 or ch in "\n\t")
            try:
                data = json.loads(cleaned)
            except Exception:
                continue

        candidates: list[Any] = []
        if isinstance(data, list):
            candidates.extend(data)
        elif isinstance(data, dict):
            if isinstance(data.get("@graph"), list):
                candidates.extend(data["@graph"])
            else:
                candidates.append(data)

        for item in candidates:
            if not isinstance(item, dict):
                continue
            t = item.get("@type")
            if t == "Product" or (isinstance(t, list) and "Product" in t):
                return item
    return None


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _extract_us_msrp(ld: dict[str, Any]) -> tuple[float | None, str]:
    offers = ld.get("offers")
    if not offers:
        return None, ""

    offer_items = offers if isinstance(offers, list) else [offers]
    best_price: float | None = None
    best_currency = ""

    for offer in offer_items:
        if not isinstance(offer, dict):
            continue

        currency = str(offer.get("priceCurrency") or "").upper().strip()
        if currency != "USD":
            continue

        # Prefer explicit list/MSRP style priceSpecification entries.
        ps = offer.get("priceSpecification")
        specs = ps if isinstance(ps, list) else ([ps] if isinstance(ps, dict) else [])
        for spec in specs:
            if not isinstance(spec, dict):
                continue
            spec_currency = str(spec.get("priceCurrency") or currency).upper().strip()
            if spec_currency != "USD":
                continue
            ptype = str(spec.get("priceType") or "").lower()
            candidate = _to_float(spec.get("price"))
            if candidate is None or candidate <= 0:
                continue
            if any(k in ptype for k in ("list", "msrp", "strikethrough", "regular", "old")):
                if best_price is None or candidate > best_price:
                    best_price = candidate
                    best_currency = "USD"

        # Fallback candidates when explicit MSRP markers are absent.
        for field in ("highPrice", "price", "regularPrice", "compareAtPrice", "lowPrice"):
            candidate = _to_float(offer.get(field))
            if candidate is None or candidate <= 0:
                continue
            if best_price is None or candidate > best_price:
                best_price = candidate
                best_currency = "USD"

    return best_price, best_currency


def _fetch_targets(con: sqlite3.Connection, brands: list[str] | None, limit: int | None) -> list[TargetRow]:
    where_parts = [
        "COALESCE(available,1)=1",
        "COALESCE(excluded,0)=0",
        "COALESCE(discontinued,0)=0",
        "price IS NULL",
        "url IS NOT NULL",
        "url != ''",
    ]
    params: list[Any] = []

    if brands:
        placeholders = ",".join("?" for _ in brands)
        where_parts.append(f"brand IN ({placeholders})")
        params.extend(brands)

    sql = (
        "SELECT id, brand, product_id, name, url FROM products "
        f"WHERE {' AND '.join(where_parts)} ORDER BY brand, id"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"

    rows = con.execute(sql, params).fetchall()
    return [TargetRow(*r) for r in rows]


async def _fetch_html(session: aiohttp.ClientSession, url: str, timeout: int) -> tuple[int, str, str]:
    for _ in range(3):
        try:
            async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=timeout), allow_redirects=True) as resp:
                text = await resp.text(errors="ignore")
                if resp.status in (429, 500, 502, 503, 504):
                    await asyncio.sleep(1.25)
                    continue
                return resp.status, text, str(resp.url)
        except Exception:
            await asyncio.sleep(0.8)
    return 0, "", ""


async def run(args: argparse.Namespace) -> int:
    con = sqlite3.connect(args.db)
    host_map = _brand_host_map()

    brands = [b.strip() for b in (args.brands or []) if b.strip()]
    targets = _fetch_targets(con, brands or None, args.limit)
    print(f"Targets missing price: {len(targets)}")
    if not targets:
        con.close()
        return 0

    stats: dict[str, int] = defaultdict(int)
    sem = asyncio.Semaphore(args.concurrency)
    host_sems: dict[str, asyncio.Semaphore] = defaultdict(lambda: asyncio.Semaphore(1))
    db_lock = asyncio.Lock()
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())

    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=args.concurrency, ssl=ssl_ctx)) as session:

        async def worker(row: TargetRow) -> None:
            async with sem:
                if row.brand not in host_map:
                    stats["brand_without_official_domain_map"] += 1
                    return

                if not _is_official_domain(row.brand, row.url, host_map):
                    stats["skipped_non_official_domain"] += 1
                    return

                host = urlparse(row.url).netloc.lower().replace("www.", "")
                async with host_sems[host]:
                    await asyncio.sleep(args.domain_delay)
                    status, html, final_url = await _fetch_html(session, row.url, args.timeout)
                if status != 200 or not html:
                    stats["fetch_failed"] += 1
                    if status:
                        stats[f"http_{status}"] += 1
                    else:
                        stats["http_0"] += 1
                    return

                if final_url and not _is_official_domain(row.brand, final_url, host_map):
                    stats["redirected_to_non_official_domain"] += 1
                    return

                ld = _find_product_ld(html)
                if not ld:
                    stats["missing_jsonld_product"] += 1
                    return

                msrp, currency = _extract_us_msrp(ld)
                if msrp is None or currency != "USD":
                    stats["no_us_msrp_found"] += 1
                    return

                if args.dry_run:
                    stats["dry_run_would_update"] += 1
                    return

                async with db_lock:
                    con.execute(
                        "UPDATE products SET price=?, currency='USD', scraped_at=datetime('now') WHERE id=? AND price IS NULL",
                        (msrp, row.row_id),
                    )
                    con.commit()
                stats["updated"] += 1

        for i in range(0, len(targets), 100):
            batch = targets[i : i + 100]
            await asyncio.gather(*(worker(r) for r in batch))
            done = i + len(batch)
            print(
                f"[{done}/{len(targets)}] updated={stats['updated']} dry_run={stats['dry_run_would_update']} "
                f"non_official={stats['skipped_non_official_domain']} no_us_msrp={stats['no_us_msrp_found']} "
                f"no_ld={stats['missing_jsonld_product']} fetch_failed={stats['fetch_failed']}",
                flush=True,
            )

    remaining = con.execute(
        """
        SELECT COUNT(*)
        FROM products
        WHERE COALESCE(available,1)=1
          AND COALESCE(excluded,0)=0
          AND COALESCE(discontinued,0)=0
          AND price IS NULL
        """
    ).fetchone()[0]

    print("\nFinal stats:")
    for k in sorted(stats):
        print(f"- {k}: {stats[k]}")
    print(f"Remaining missing prices (active scope): {remaining}")

    con.close()
    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Backfill missing prices from official US MSRP/list prices only.")
    p.add_argument("--db", default=ROOT_DB, help="SQLite DB path")
    p.add_argument("--brands", nargs="*", help="Optional brand slug filters")
    p.add_argument("--limit", type=int, help="Optional max rows")
    p.add_argument("--concurrency", type=int, default=10)
    p.add_argument("--domain-delay", type=float, default=1.5)
    p.add_argument("--timeout", type=int, default=25)
    p.add_argument("--dry-run", action="store_true", help="Scan without writing updates")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    try:
        raise SystemExit(asyncio.run(run(args)))
    except KeyboardInterrupt:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
