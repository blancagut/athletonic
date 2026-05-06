"""
Generic Shopify storefront scraper.

Uses the public /products.json endpoint (no auth required).
Handles cursor-based pagination via the Link header and also
falls back to legacy ?page=N pagination.
"""
import asyncio
import re
import ssl
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urljoin

import aiohttp
import certifi
from tenacity import retry, stop_after_attempt, wait_random_exponential

from config import (
    DELAY_BETWEEN_PAGES,
    REQUEST_TIMEOUT,
    RETRY_WAIT_MAX,
    RETRY_WAIT_MIN,
    SHOPIFY_PAGE_LIMIT,
    USER_AGENT,
)
from scrapers.base import BaseScraper


class ShopifyScraper(BaseScraper):
    """
    Reusable Shopify scraper – subclass and set brand_slug / display_name / base_url.
    """

    collection_handle: Optional[str] = None
    sort_by: Optional[str] = None
    max_products: Optional[int] = None

    def __init__(self) -> None:
        super().__init__()
        self._ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        self._headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

    # ── internal helpers ───────────────────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(6),
        wait=wait_random_exponential(min=10, max=60),
        reraise=True,
    )
    async def _get_json(
        self, session: aiohttp.ClientSession, url: str
    ) -> tuple[Optional[Dict], Optional[str]]:
        """
        Fetch a JSON URL.  Returns (data, next_page_url).
        next_page_url is extracted from the Link: <url>; rel="next" header.
        """
        timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
        async with session.get(url, headers=self._headers, timeout=timeout, ssl=self._ssl_ctx) as resp:
            if resp.status == 429:
                retry_after = int(resp.headers.get("Retry-After", "30"))
                self.log.warning("Rate limited (429), waiting %ds …", retry_after)
                await asyncio.sleep(retry_after)
                resp.raise_for_status()  # trigger tenacity retry
            resp.raise_for_status()
            data = await resp.json(content_type=None)
            next_url = self._parse_next_link(resp.headers.get("Link", ""))
            return data, next_url

    @staticmethod
    def _parse_next_link(link_header: str) -> Optional[str]:
        """Parse the Shopify Link header and return the 'next' URL if present."""
        if not link_header:
            return None
        match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
        return match.group(1) if match else None

    def _products_url(self, page: int = 1, page_info: Optional[str] = None) -> str:
        limit = min(SHOPIFY_PAGE_LIMIT, self.max_products or SHOPIFY_PAGE_LIMIT)
        params: Dict[str, Any] = {"limit": limit}
        if self.sort_by:
            params["sort_by"] = self.sort_by
        if page_info:
            params["page_info"] = page_info
        else:
            params["page"] = page
        product_path = "/products.json"
        if self.collection_handle:
            product_path = f"/collections/{self.collection_handle}/products.json"
        return f"{self.base_url.rstrip('/')}{product_path}?{urlencode(params)}"

    # ── product parsing ────────────────────────────────────────────────────────

    @staticmethod
    def _parse_product(raw: Dict, brand_slug: str, base_url: str) -> Dict[str, Any]:
        handle = raw.get("handle", "")
        url    = f"{base_url.rstrip('/')}/products/{handle}"

        # lowest variant price as the headline price
        variants_raw = raw.get("variants", [])
        prices = [
            float(v["price"]) for v in variants_raw if v.get("price") not in (None, "", "0.00", 0)
        ]
        compare_prices = [
            float(v["compare_at_price"])
            for v in variants_raw
            if v.get("compare_at_price") not in (None, "", 0)
        ]
        price            = min(prices)            if prices            else None
        compare_at_price = min(compare_prices)    if compare_prices    else None

        variants = [
            {
                "variant_id":       str(v.get("id", "")),
                "title":            v.get("title"),
                "sku":              v.get("sku"),
                "option1":          v.get("option1"),
                "option2":          v.get("option2"),
                "option3":          v.get("option3"),
                "price":            float(v["price"]) if v.get("price") else None,
                "compare_at_price": float(v["compare_at_price"]) if v.get("compare_at_price") else None,
                "available":        v.get("available", True),
                "weight_grams":     v.get("grams"),
            }
            for v in variants_raw
        ]

        images = [
            {
                "url":      img.get("src", "").split("?")[0],  # strip CDN versioning
                "alt":      img.get("alt"),
                "position": img.get("position", 0),
                "width":    img.get("width"),
                "height":   img.get("height"),
                "local_path": None,
            }
            for img in raw.get("images", [])
            if img.get("src")
        ]

        options = [
            {"name": opt["name"], "values": opt["values"]}
            for opt in raw.get("options", [])
        ]

        # pick the primary SKU from the first variant with one
        sku = next((v.get("sku") for v in variants_raw if v.get("sku")), None)

        return {
            "brand":            brand_slug,
            "product_id":       str(raw.get("id", "")),
            "vendor":           raw.get("vendor", ""),
            "sku":              sku,
            "name":             raw.get("title", ""),
            "handle":           handle,
            "url":              url,
            "description_html": raw.get("body_html", ""),
            "category":         raw.get("product_type", ""),
            "tags":             raw.get("tags", []),
            "price":            price,
            "compare_at_price": compare_at_price,
            "currency":         "USD",
            "available":        any(v.get("available", True) for v in variants_raw),
            "variants":         variants,
            "images":           images,
            "options":          options,
        }

    # ── main scrape loop ───────────────────────────────────────────────────────

    async def scrape(self) -> List[Dict[str, Any]]:
        products: List[Dict[str, Any]] = []
        page      = 1
        next_url: Optional[str] = None

        async with aiohttp.ClientSession() as session:
            while True:
                url = next_url or self._products_url(page)
                self.log.debug("Fetching page %d → %s", page, url)

                try:
                    data, next_url = await self._get_json(session, url)
                except Exception as exc:
                    self.log.error("Failed fetching page %d: %s", page, exc)
                    break

                raw_products = (data or {}).get("products", [])
                if not raw_products:
                    break

                for raw in raw_products:
                    if self.max_products is not None and len(products) >= self.max_products:
                        break
                    products.append(
                        self._parse_product(raw, self.brand_slug, self.base_url)
                    )

                self.log.info(
                    "%s – page %d → %d products (total: %d)",
                    self.display_name,
                    page,
                    len(raw_products),
                    len(products),
                )

                if self.max_products is not None and len(products) >= self.max_products:
                    break
                if next_url:
                    # cursor-based pagination
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                    page += 1
                elif len(raw_products) == SHOPIFY_PAGE_LIMIT:
                    # legacy page-based: there might be more
                    page += 1
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                else:
                    break  # last page reached

        self.log.info("%s – total %d products scraped", self.display_name, len(products))
        return products
