"""Description enrichment v2: per-host rate limiting + 404 marking + junk filtering."""
from __future__ import annotations

import asyncio
import json
import re
import ssl
import sqlite3
from typing import Optional
from urllib.parse import urlparse

import aiohttp
import certifi

from config import DB_PATH, REQUEST_TIMEOUT, USER_AGENT

PER_HOST_CONCURRENCY = 2
PER_HOST_DELAY = 1.0
MAX_429_RETRIES = 3

JUNK_PATTERNS = re.compile(
    r"\b(gift\s*card|e-?gift|build\s*your\s*own|sample|sticker|t-?shirt|hoodie|tank\s*top|coffee\s*mug|"
    r"shaker|water\s*bottle|wristband|hat|cap|pin|patch|poster|tote\s*bag|sweatshirt|"
    r"face\s*mask|backpack|membership|subscription\s*box)\b",
    re.IGNORECASE,
)


def _is_junk(name: str) -> bool:
    return bool(JUNK_PATTERNS.search(name or ""))


def _extract_description(html: str) -> Optional[str]:
    for blob in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            data = json.loads(blob.strip())
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if not isinstance(it, dict):
                continue
            t = it.get("@type")
            if (isinstance(t, str) and t.lower() == "product") or (isinstance(t, list) and "Product" in t):
                desc = it.get("description")
                if desc and isinstance(desc, str) and desc.strip():
                    return desc.strip()
            for g in (it.get("@graph") or []):
                if isinstance(g, dict) and (g.get("@type") == "Product" or "Product" in (g.get("@type") or [])):
                    desc = g.get("description")
                    if desc and isinstance(desc, str) and desc.strip():
                        return desc.strip()
    m = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if m and m.group(1).strip():
        return m.group(1).strip()
    m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if m and m.group(1).strip():
        return m.group(1).strip()
    return None


class _HostThrottle:
    def __init__(self):
        self._sems: dict[str, asyncio.Semaphore] = {}

    def sem(self, host: str) -> asyncio.Semaphore:
        if host not in self._sems:
            self._sems[host] = asyncio.Semaphore(PER_HOST_CONCURRENCY)
        return self._sems[host]


async def _fetch(session, url, ssl_ctx):
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
    for _ in range(MAX_429_RETRIES + 1):
        try:
            async with session.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout, ssl=ssl_ctx, allow_redirects=True) as resp:
                if resp.status == 429:
                    wait = int(resp.headers.get("Retry-After", "30"))
                    await asyncio.sleep(min(wait, 60))
                    continue
                if resp.status == 404:
                    return 404, None
                if resp.status != 200:
                    return resp.status, None
                return 200, await resp.text(errors="ignore")
        except Exception:
            await asyncio.sleep(2)
    return 0, None


async def enrich_descriptions(brands=None, limit=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    where = "(description_html IS NULL OR description_html='') AND url IS NOT NULL AND url != ''"
    params = []
    if brands:
        ph = ",".join("?" for _ in brands)
        where += f" AND brand IN ({ph})"
        params.extend(brands)
    sql = f"SELECT id, brand, name, url FROM products WHERE {where}"
    if limit:
        sql += f" LIMIT {int(limit)}"
    rows = conn.execute(sql, params).fetchall()
    conn.close()

    if not rows:
        return {"checked": 0, "updated": 0, "junk": 0, "not_found": 0}

    junk_ids = {r["id"] for r in rows if _is_junk(r["name"])}
    rows = [r for r in rows if r["id"] not in junk_ids]

    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    throttle = _HostThrottle()
    updates = []
    not_found = []

    async def worker(row, session):
        host = urlparse(row["url"]).netloc
        async with throttle.sem(host):
            status, html = await _fetch(session, row["url"], ssl_ctx)
            await asyncio.sleep(PER_HOST_DELAY)
        if status == 404:
            not_found.append(row["id"])
            return
        if not html:
            return
        desc = _extract_description(html)
        if desc:
            updates.append((row["id"], desc))

    connector = aiohttp.TCPConnector(limit=32, ssl=ssl_ctx)
    async with aiohttp.ClientSession(connector=connector) as session:
        await asyncio.gather(*(worker(r, session) for r in rows))

    conn = sqlite3.connect(DB_PATH)
    if updates:
        conn.executemany("UPDATE products SET description_html = ? WHERE id = ?", [(d, i) for (i, d) in updates])
    if not_found:
        conn.executemany("UPDATE products SET available = 0 WHERE id = ?", [(i,) for i in not_found])
    conn.commit()
    conn.close()

    return {"checked": len(rows), "updated": len(updates), "junk": len(junk_ids), "not_found": len(not_found)}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--brands", nargs="*")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()
    out = asyncio.run(enrich_descriptions(args.brands, args.limit))
    print(f"Checked {out['checked']} | Updated {out['updated']} | Junk-skipped {out['junk']} | 404→discontinued {out['not_found']}")
