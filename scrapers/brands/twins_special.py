"""
Twins Special BigCommerce scraper.

Strategy:
  1. Walk paginated sitemap at /xmlsitemap.php?type=products&page=N
  2. For each product URL fetch the page
  3. Parse JSON-LD Product schema for name / SKU / price / currency / description
  4. Extract ALL product images from the page (960x960 canonical size)
  5. Extract option/variant labels from page HTML
"""
import asyncio
import re
import ssl
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import aiohttp
import certifi
from tenacity import retry, stop_after_attempt, wait_random_exponential

from config import DELAY_BETWEEN_PAGES, REQUEST_TIMEOUT, USER_AGENT
from scrapers.base import BaseScraper

import json as _json

_SITEMAP_BASE = "https://twins-special.com/xmlsitemap.php?type=products&page={page}"
_IMG_PATTERN  = re.compile(
    r"https://cdn11\.bigcommerce\.com/s-zueukrvtuw/images/stencil/\d+x\d+/"
    r"products/(\d+)/(\d+)/([^\"?\s\\]+\.(?:jpg|png|webp))"
)
_STORE_HASH   = "zueukrvtuw"


class TwinsSpecialScraper(BaseScraper):
    brand_slug   = "twins_special"
    display_name = "Twins Special"
    base_url     = "https://twins-special.com"

    def __init__(self) -> None:
        super().__init__()
        self._ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        self._headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }

    # ── helpers ────────────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(5), wait=wait_random_exponential(min=5, max=40), reraise=True)
    async def _get(self, session: aiohttp.ClientSession, url: str) -> str:
        timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
        async with session.get(url, headers=self._headers, ssl=self._ssl_ctx, timeout=timeout) as r:
            if r.status == 429:
                await asyncio.sleep(int(r.headers.get("Retry-After", "30")))
                r.raise_for_status()
            r.raise_for_status()
            return await r.text()

    # ── sitemap pages ───────────────────────────────────────────────────────────

    async def _product_urls(self, session: aiohttp.ClientSession) -> List[str]:
        """Walk all product sitemap pages and return unique product URLs."""
        urls: List[str] = []
        page = 1
        while True:
            try:
                xml = await self._get(session, _SITEMAP_BASE.format(page=page))
            except Exception as exc:
                self.log.error("Sitemap page %d failed: %s", page, exc)
                break
            found = re.findall(r"<loc>(https://twins-special\.com/[^<]+)</loc>", xml)
            if not found:
                break
            self.log.info("Sitemap page %d → %d URLs", page, len(found))
            urls.extend(found)
            # BigCommerce paginates at 500; if we got fewer this is the last page
            if len(found) < 500:
                break
            page += 1
            await asyncio.sleep(DELAY_BETWEEN_PAGES)
        return list(dict.fromkeys(urls))  # deduplicate while preserving order

    # ── product parsing ─────────────────────────────────────────────────────────

    def _parse_page(self, html: str, url: str) -> Optional[Dict[str, Any]]:
        # 1) JSON-LD Product block
        ld_blocks = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL,
        )
        product_ld: Dict = {}
        for block in ld_blocks:
            try:
                d = _json.loads(block)
                if d.get("@type") == "Product":
                    product_ld = d
                    break
            except Exception:
                continue

        if not product_ld:
            return None

        name = product_ld.get("name", "")
        sku  = product_ld.get("sku", "")
        desc = product_ld.get("description", "")

        offer = product_ld.get("offers", {})
        try:
            price = float(offer.get("price", 0) or 0) or None
        except (TypeError, ValueError):
            price = None
        currency     = offer.get("priceCurrency", "USD")
        availability = offer.get("availability", "")
        available    = "InStock" in availability if availability else True

        # 2) Collect ALL product images from CDN (deduplicate by image-id)
        #    Use the highest-res canonical size found: prefer 1920x1920, else 960x960
        img_map: Dict[str, str] = {}  # image_id → canonical URL
        for prod_id, img_id, fname in _IMG_PATTERN.findall(html):
            # Only keep images belonging to THIS product (skip recommended-product thumbnails)
            # We identify the main product's ID from JSON-LD image URL
            canonical = f"https://cdn11.bigcommerce.com/s-{_STORE_HASH}/images/stencil/1920x1920/products/{prod_id}/{img_id}/{fname.split('?')[0]}"
            if img_id not in img_map:
                img_map[img_id] = canonical

        # Filter to current product's images by matching prod_id from JSON-LD primary image
        ld_image_url = product_ld.get("image", "")
        primary_prod_id = ""
        m = re.search(r"/products/(\d+)/", ld_image_url)
        if m:
            primary_prod_id = m.group(1)

        if primary_prod_id:
            images = [
                {"url": img_url, "alt": name, "position": idx, "width": 1920, "height": 1920, "local_path": None}
                for idx, (img_id, img_url) in enumerate(
                    (item for item in img_map.items()
                     if f"/products/{primary_prod_id}/" in item[1])
                )
            ]
        else:
            # fallback: just use JSON-LD image
            images = [{"url": ld_image_url, "alt": name, "position": 0, "width": None, "height": None, "local_path": None}] if ld_image_url else []

        # Sort images: primary image (from JSON-LD) first, then extras
        if images and ld_image_url:
            primary_fname = ld_image_url.split("/")[-1].split("?")[0]
            images.sort(key=lambda im: (0 if primary_fname in im["url"] else 1, im["position"]))
            for i, im in enumerate(images):
                im["position"] = i

        # 3) Slug / handle from URL
        handle = url.rstrip("/").split("/")[-1]

        # 4) Category from breadcrumb JSON-LD
        category = ""
        for block in ld_blocks:
            try:
                d = _json.loads(block)
                if d.get("@type") == "BreadcrumbList":
                    items = d.get("itemListElement", [])
                    if len(items) >= 2:
                        category = items[-2].get("item", {}).get("name", "")
                    break
            except Exception:
                continue

        return {
            "brand":            self.brand_slug,
            "product_id":       sku or handle,
            "vendor":           self.brand_slug,
            "sku":              sku,
            "name":             name,
            "handle":           handle,
            "url":              url,
            "description_html": desc,
            "category":         category,
            "tags":             [],
            "price":            price,
            "compare_at_price": None,
            "currency":         currency,
            "available":        available,
            "variants":         [
                {
                    "variant_id":    sku or handle,
                    "title":         "Default",
                    "sku":           sku,
                    "option1":       None,
                    "option2":       None,
                    "option3":       None,
                    "price":         price,
                    "compare_at_price": None,
                    "available":     available,
                    "weight_grams":  None,
                }
            ],
            "images":           images,
            "options":          [],
        }

    # ── main scrape ─────────────────────────────────────────────────────────────

    async def scrape(self) -> List[Dict[str, Any]]:
        products: List[Dict[str, Any]] = []
        async with aiohttp.ClientSession() as session:
            prod_urls = await self._product_urls(session)
            self.log.info("%s – %d product URLs from sitemap", self.display_name, len(prod_urls))

            for idx, url in enumerate(prod_urls):
                try:
                    html = await self._get(session, url)
                    product = self._parse_page(html, url)
                    if product:
                        products.append(product)
                        if (idx + 1) % 20 == 0:
                            self.log.info("  … %d/%d done", idx + 1, len(prod_urls))
                    else:
                        self.log.warning("Could not parse %s", url)
                except Exception as exc:
                    self.log.error("Failed %s: %s", url, exc)

                if idx < len(prod_urls) - 1:
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)

        self.log.info("%s – total %d products scraped", self.display_name, len(products))
        return products
