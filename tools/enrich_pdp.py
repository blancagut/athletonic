"""PDP enrichment: fetch product detail pages to fill gaps in price / description /
images. Uses JSON-LD `Product` schema as primary source, og:description fallback.

Features
--------
- Per-domain semaphore (1 concurrent request per host) + polite delay
- Full browser headers (Chrome on macOS) to avoid 429
- 404 → mark product as `discontinued`
- Pre-filter obvious junk (gift cards, dynamic bundles, shipping insurance)
- Idempotent: only updates fields that are currently NULL/empty
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sqlite3
import ssl
import sys
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import aiohttp
import certifi

DB_PATH = "output/data/products.db"

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
OG_DESC_RE = re.compile(
    r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)',
    re.IGNORECASE,
)
META_DESC_RE = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
    re.IGNORECASE,
)

JUNK_PATTERNS = {
    "gift_card":   re.compile(r"gift-?card|egift", re.I),
    "bundle_dyn":  re.compile(r"build-your-own|customize-your|sample-pack-build", re.I),
    "shipping":    re.compile(r"shipping[-_]?(protection|insurance)|route[-_]?protect", re.I),
}


# ── DB helpers ───────────────────────────────────────────────────────────────
def ensure_columns(con: sqlite3.Connection) -> None:
    cols = {r[1] for r in con.execute("PRAGMA table_info(products)")}
    if "discontinued" not in cols:
        con.execute("ALTER TABLE products ADD COLUMN discontinued INTEGER DEFAULT 0")
    if "excluded" not in cols:
        con.execute("ALTER TABLE products ADD COLUMN excluded INTEGER DEFAULT 0")
    if "excluded_reason" not in cols:
        con.execute("ALTER TABLE products ADD COLUMN excluded_reason TEXT")
    if "enriched_at" not in cols:
        con.execute("ALTER TABLE products ADD COLUMN enriched_at TEXT")
    con.commit()


def classify_junk(name: str, handle: str) -> Optional[str]:
    s = f"{handle or ''} {name or ''}"
    for tag, pat in JUNK_PATTERNS.items():
        if pat.search(s):
            return tag
    return None


def fetch_targets(con: sqlite3.Connection, brand: Optional[str], limit: Optional[int]) -> List[sqlite3.Row]:
    sql = """
      SELECT p.id, p.brand, p.name, p.handle, p.url, p.description_html, p.price,
             p.product_id,
             (SELECT COUNT(*) FROM images i WHERE i.product_row_id = p.id) AS img_count
      FROM products p
      WHERE COALESCE(p.discontinued, 0) = 0
        AND COALESCE(p.excluded, 0) = 0
        AND p.url IS NOT NULL AND p.url != ''
        AND (
          (p.description_html IS NULL OR p.description_html = '')
          OR p.price IS NULL
          OR (SELECT COUNT(*) FROM images i WHERE i.product_row_id = p.id) = 0
        )
    """
    params: List[Any] = []
    if brand:
        sql += " AND p.brand = ?"
        params.append(brand)
    sql += " ORDER BY p.brand, p.id"
    if limit:
        sql += f" LIMIT {int(limit)}"
    return list(con.execute(sql, params).fetchall())


# ── Parsing ──────────────────────────────────────────────────────────────────
def find_product_ld(html: str) -> Optional[Dict[str, Any]]:
    for raw in LD_RE.findall(html):
        try:
            data = json.loads(raw.strip())
        except Exception:
            # try to fix common issues: trailing commas / control chars
            cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
            cleaned = "".join(ch for ch in cleaned if ord(ch) >= 0x20 or ch in "\n\t")
            try:
                data = json.loads(cleaned)
            except Exception:
                continue
        # Possible shapes: dict, list, dict with @graph
        candidates: List[Any] = []
        if isinstance(data, list):
            candidates.extend(data)
        elif isinstance(data, dict):
            if "@graph" in data and isinstance(data["@graph"], list):
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


def extract_price(ld: Dict[str, Any]) -> Tuple[Optional[float], Optional[str]]:
    offers = ld.get("offers")
    if not offers:
        return None, None
    if isinstance(offers, list):
        offers = offers[0] if offers else None
    if not isinstance(offers, dict):
        return None, None
    price_str = offers.get("price") or offers.get("lowPrice") or offers.get("highPrice")
    currency = offers.get("priceCurrency") or "USD"
    try:
        return (float(price_str), currency) if price_str not in (None, "", "0", 0) else (None, currency)
    except (TypeError, ValueError):
        return None, currency


def extract_images(ld: Dict[str, Any]) -> List[str]:
    imgs = ld.get("image")
    if not imgs:
        return []
    if isinstance(imgs, str):
        return [imgs.split("?")[0]]
    if isinstance(imgs, list):
        out = []
        for x in imgs:
            if isinstance(x, str):
                out.append(x.split("?")[0])
            elif isinstance(x, dict) and x.get("url"):
                out.append(x["url"].split("?")[0])
        return out
    if isinstance(imgs, dict) and imgs.get("url"):
        return [imgs["url"].split("?")[0]]
    return []


# ── HTTP layer with per-domain throttling ────────────────────────────────────
class DomainThrottler:
    """One concurrent request per host + polite delay between them."""

    def __init__(self, delay: float = 2.0) -> None:
        self.delay = delay
        self._sems: Dict[str, asyncio.Semaphore] = defaultdict(lambda: asyncio.Semaphore(1))
        self._last: Dict[str, float] = defaultdict(lambda: 0.0)

    async def acquire(self, host: str) -> asyncio.Semaphore:
        sem = self._sems[host]
        await sem.acquire()
        # enforce delay
        loop = asyncio.get_event_loop()
        gap = loop.time() - self._last[host]
        if gap < self.delay:
            await asyncio.sleep(self.delay - gap)
        self._last[host] = loop.time()
        return sem


async def fetch_html(
    session: aiohttp.ClientSession, url: str, throttler: DomainThrottler
) -> Tuple[int, str]:
    host = urlparse(url).netloc
    sem = await throttler.acquire(host)
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=25), allow_redirects=True) as resp:
            text = await resp.text(errors="ignore")
            return resp.status, text
    finally:
        sem.release()


# ── Worker ────────────────────────────────────────────────────────────────────
async def enrich_one(
    row: sqlite3.Row,
    session: aiohttp.ClientSession,
    throttler: DomainThrottler,
    db_lock: asyncio.Lock,
    con: sqlite3.Connection,
    stats: Dict[str, int],
) -> None:
    pid, brand, name, handle, url, desc, price, prod_id, img_count = row

    # Junk pre-filter
    junk = classify_junk(name or "", handle or "")
    if junk:
        async with db_lock:
            con.execute("UPDATE products SET excluded=1, excluded_reason=? WHERE id=?", (junk, pid))
            con.commit()
        stats["excluded"] += 1
        return

    try:
        status, html = await fetch_html(session, url, throttler)
    except asyncio.TimeoutError:
        stats["timeout"] += 1
        return
    except Exception as exc:
        msg = str(exc)
        if "429" in msg:
            stats["http_429"] += 1
        else:
            stats["fetch_err"] += 1
        return

    if status == 404:
        async with db_lock:
            con.execute(
                "UPDATE products SET discontinued=1, enriched_at=datetime('now') WHERE id=?",
                (pid,),
            )
            con.commit()
        stats["discontinued"] += 1
        return
    if status == 429:
        stats["http_429"] += 1
        return
    if status >= 400:
        stats["fetch_err"] += 1
        return

    ld = find_product_ld(html)
    new_desc = None
    new_price = None
    new_currency = None
    new_images: List[str] = []

    if ld:
        if not desc:
            d = ld.get("description") or ""
            if d.strip():
                new_desc = d.strip()
        if price is None:
            p, cur = extract_price(ld)
            if p is not None:
                new_price = p
                new_currency = cur
        if img_count == 0:
            new_images = extract_images(ld)

    # og:description fallback for description only
    if not new_desc and not desc:
        m = OG_DESC_RE.search(html)
        if m:
            t = m.group(1).strip()
            if t and len(t) > 30:  # avoid tiny generic blurbs
                new_desc = t

    if not (new_desc or new_price is not None or new_images):
        stats["nothing_new"] += 1
        async with db_lock:
            con.execute("UPDATE products SET enriched_at=datetime('now') WHERE id=?", (pid,))
            con.commit()
        return

    async with db_lock:
        sets, params = [], []
        if new_desc:
            sets.append("description_html=?")
            params.append(new_desc)
            stats["desc_filled"] += 1
        if new_price is not None:
            sets.append("price=?")
            params.append(new_price)
            stats["price_filled"] += 1
        if new_currency:
            sets.append("currency=COALESCE(currency, ?)")
            params.append(new_currency)
        sets.append("enriched_at=datetime('now')")
        params.append(pid)
        con.execute(f"UPDATE products SET {', '.join(sets)} WHERE id=?", params)
        if new_images:
            existing_urls = {
                r[0] for r in con.execute(
                    "SELECT url FROM images WHERE product_row_id=?", (pid,)
                ).fetchall()
            }
            for idx, iu in enumerate(new_images):
                if iu in existing_urls:
                    continue
                con.execute(
                    """INSERT INTO images
                       (product_row_id, brand, product_id, position, url, alt)
                       VALUES (?, ?, ?, ?, ?, NULL)""",
                    (pid, brand, prod_id or f"pdp:{pid}", idx, iu),
                )
            stats["img_filled"] += 1
        con.commit()


# ── Main ──────────────────────────────────────────────────────────────────────
async def run(brand: Optional[str], limit: Optional[int], concurrency: int, delay: float) -> None:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = lambda cur, row: row  # tuple
    ensure_columns(con)
    targets = fetch_targets(con, brand, limit)
    print(f"Targets: {len(targets)}")
    if not targets:
        return

    throttler = DomainThrottler(delay=delay)
    db_lock = asyncio.Lock()
    stats: Dict[str, int] = defaultdict(int)

    connector = aiohttp.TCPConnector(limit=concurrency, ssl=ssl.create_default_context(cafile=certifi.where()))
    async with aiohttp.ClientSession(connector=connector) as session:
        # process 50 at a time so logs are useful
        for i in range(0, len(targets), 50):
            batch = targets[i : i + 50]
            await asyncio.gather(*[
                enrich_one(row, session, throttler, db_lock, con, stats) for row in batch
            ])
            done = i + len(batch)
            print(
                f"  [{done}/{len(targets)}] desc+={stats['desc_filled']} price+={stats['price_filled']} "
                f"img+={stats['img_filled']} disc={stats['discontinued']} excl={stats['excluded']} "
                f"429={stats['http_429']} err={stats['fetch_err']} timeout={stats['timeout']}",
                flush=True,
            )

    print("\n=== FINAL ===")
    for k, v in sorted(stats.items()):
        print(f"  {k:<18} {v}")
    con.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brand", help="Restrict to one brand")
    ap.add_argument("--limit", type=int, help="Max rows to process")
    ap.add_argument("--concurrency", type=int, default=8, help="Total parallel requests")
    ap.add_argument("--delay", type=float, default=2.0, help="Per-domain delay seconds")
    args = ap.parse_args()
    try:
        asyncio.run(run(args.brand, args.limit, args.concurrency, args.delay))
    except KeyboardInterrupt:
        sys.exit(1)


if __name__ == "__main__":
    main()
