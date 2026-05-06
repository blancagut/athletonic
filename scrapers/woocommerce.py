"""Generic WooCommerce Store API scraper.

Uses the public /wp-json/wc/store/v1/products?per_page=N&page=M endpoint.
Subclass and set brand_slug / display_name / base_url.
"""
import asyncio
import ssl
from typing import Any, Dict, List

import aiohttp
import certifi
from tenacity import retry, stop_after_attempt, wait_random_exponential

from config import (
    DELAY_BETWEEN_PAGES,
    REQUEST_TIMEOUT,
    USER_AGENT,
)
from scrapers.base import BaseScraper


class WooCommerceScraper(BaseScraper):
    """WooCommerce Store API scraper (no auth required)."""

    page_size = 100

    def __init__(self) -> None:
        super().__init__()
        self._ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        self._headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

    @retry(stop=stop_after_attempt(5), wait=wait_random_exponential(min=5, max=45), reraise=True)
    async def _get_json(self, session: aiohttp.ClientSession, url: str) -> List[Dict]:
        timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
        async with session.get(url, headers=self._headers, timeout=timeout, ssl=self._ssl_ctx) as resp:
            if resp.status == 429:
                await asyncio.sleep(int(resp.headers.get("Retry-After", "30")))
                resp.raise_for_status()
            resp.raise_for_status()
            return await resp.json(content_type=None)

    @staticmethod
    def _parse_product(raw: Dict, brand_slug: str, base_url: str) -> Dict[str, Any]:
        prices = raw.get("prices") or {}
        cur_minor = int(prices.get("currency_minor_unit", 2) or 2)
        divisor = 10 ** cur_minor

        def to_money(v):
            if v in (None, "", 0, "0"):
                return None
            try:
                return float(v) / divisor
            except (TypeError, ValueError):
                return None

        price = to_money(prices.get("price"))
        regular = to_money(prices.get("regular_price"))
        compare = regular if regular and price and regular > price else None

        images = [
            {
                "url": img.get("src", "").split("?")[0],
                "alt": img.get("alt"),
                "position": idx,
                "width": None,
                "height": None,
                "local_path": None,
            }
            for idx, img in enumerate(raw.get("images", []) or [])
            if img.get("src")
        ]

        variations = raw.get("variations") or []
        variants: List[Dict] = []
        for idx, var in enumerate(variations):
            attrs = var.get("attributes") or []
            opt_vals = [a.get("value") for a in attrs]
            variants.append({
                "variant_id": str(var.get("id", f"{raw.get('id')}-v{idx}")),
                "title": " / ".join([v for v in opt_vals if v]) or raw.get("name"),
                "sku": var.get("sku"),
                "option1": opt_vals[0] if len(opt_vals) > 0 else None,
                "option2": opt_vals[1] if len(opt_vals) > 1 else None,
                "option3": opt_vals[2] if len(opt_vals) > 2 else None,
                "price": price,
                "compare_at_price": compare,
                "available": raw.get("is_in_stock", True),
                "weight_grams": None,
            })
        if not variants:
            variants = [{
                "variant_id": str(raw.get("id")),
                "title": raw.get("name"),
                "sku": raw.get("sku"),
                "option1": None, "option2": None, "option3": None,
                "price": price,
                "compare_at_price": compare,
                "available": raw.get("is_in_stock", True),
                "weight_grams": None,
            }]

        attrs = raw.get("attributes") or []
        options = [
            {"name": a.get("name"), "values": a.get("terms", []) and [t.get("name") for t in a["terms"]] or []}
            for a in attrs if a.get("has_variations")
        ]

        cats = raw.get("categories") or []
        category = cats[0].get("name") if cats else (raw.get("type") or "")
        tags = [t.get("name") for t in (raw.get("tags") or []) if t.get("name")]

        return {
            "brand": brand_slug,
            "product_id": str(raw.get("id", "")),
            "vendor": brand_slug,
            "sku": raw.get("sku"),
            "name": raw.get("name", ""),
            "handle": raw.get("slug", ""),
            "url": raw.get("permalink") or f"{base_url.rstrip('/')}/product/{raw.get('slug','')}",
            "description_html": raw.get("description", "") or raw.get("short_description", ""),
            "category": category,
            "tags": tags,
            "price": price,
            "compare_at_price": compare,
            "currency": (prices.get("currency_code") or "USD"),
            "available": raw.get("is_in_stock", True),
            "variants": variants,
            "images": images,
            "options": options,
        }

    async def scrape(self) -> List[Dict[str, Any]]:
        products: List[Dict[str, Any]] = []
        async with aiohttp.ClientSession() as session:
            for path in ("/wp-json/wc/store/v1/products", "/wp-json/wc/store/products"):
                page = 1
                while True:
                    url = f"{self.base_url.rstrip('/')}{path}?per_page={self.page_size}&page={page}"
                    try:
                        data = await self._get_json(session, url)
                    except Exception as exc:
                        self.log.error("Failed page %d: %s", page, exc)
                        break
                    if not data:
                        break
                    for raw in data:
                        products.append(self._parse_product(raw, self.brand_slug, self.base_url))
                    self.log.info("%s – page %d → %d products (total: %d)", self.display_name, page, len(data), len(products))
                    if len(data) < self.page_size:
                        break
                    page += 1
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                if products:
                    break
        self.log.info("%s – total %d products scraped", self.display_name, len(products))
        return products
