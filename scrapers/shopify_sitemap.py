"""Shopify scraper variant that enumerates products via sitemap_products_*.xml.

Useful when /products.json hides part of the catalog (e.g. KOS).
For each handle in the sitemap we fetch /products/{handle}.json which
returns the same structure as one element of /products.json.
"""
import asyncio
import re
from typing import Any, Dict, List

import aiohttp

from config import DELAY_BETWEEN_PAGES, REQUEST_TIMEOUT
from scrapers.shopify import ShopifyScraper


class SitemapShopifyScraper(ShopifyScraper):
    """Subclass and set brand_slug / display_name / base_url."""

    sitemap_concurrency = 6

    async def _fetch_text(self, session: aiohttp.ClientSession, url: str) -> str:
        timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
        async with session.get(url, headers=self._headers, timeout=timeout, ssl=self._ssl_ctx) as resp:
            resp.raise_for_status()
            return await resp.text()

    async def _collect_handles(self, session: aiohttp.ClientSession) -> List[str]:
        # 1) sitemap index
        try:
            body = await self._fetch_text(session, f"{self.base_url.rstrip('/')}/sitemap.xml")
        except Exception as exc:
            self.log.warning("sitemap.xml failed (%s); falling back to /products.json", exc)
            return []
        sitemaps = re.findall(r"<loc>([^<]+sitemap_products[^<]+)</loc>", body)
        if not sitemaps:
            sitemaps = re.findall(r"<loc>([^<]+/products[^<]*\.xml[^<]*)</loc>", body)
        urls: List[str] = []
        if sitemaps:
            for sm in sitemaps:
                try:
                    b = await self._fetch_text(session, sm)
                    urls.extend(re.findall(r"<loc>([^<]+/products/[^<]+)</loc>", b))
                except Exception as exc:
                    self.log.warning("sitemap %s failed: %s", sm, exc)
        else:
            urls = re.findall(r"<loc>([^<]+/products/[^<]+)</loc>", body)
        # dedupe handles
        handles = []
        seen = set()
        for u in urls:
            m = re.search(r"/products/([^/?#]+)", u)
            if not m:
                continue
            h = m.group(1)
            if h in seen:
                continue
            seen.add(h)
            handles.append(h)
        return handles

    async def _fetch_product(
        self, session: aiohttp.ClientSession, handle: str, sem: asyncio.Semaphore
    ) -> Dict[str, Any] | None:
        url = f"{self.base_url.rstrip('/')}/products/{handle}.json"
        async with sem:
            try:
                data, _ = await self._get_json(session, url)
            except Exception as exc:
                self.log.warning("product %s failed: %s", handle, exc)
                return None
            raw = (data or {}).get("product")
            if not raw:
                return None
            await asyncio.sleep(DELAY_BETWEEN_PAGES / 2)
            return self._parse_product(raw, self.brand_slug, self.base_url)

    async def scrape(self) -> List[Dict[str, Any]]:
        async with aiohttp.ClientSession() as session:
            handles = await self._collect_handles(session)
            if not handles:
                self.log.info("%s – no sitemap handles, falling back to products.json", self.display_name)
                return await super().scrape()
            self.log.info("%s – sitemap returned %d handles", self.display_name, len(handles))
            sem = asyncio.Semaphore(self.sitemap_concurrency)
            tasks = [self._fetch_product(session, h, sem) for h in handles]
            results = await asyncio.gather(*tasks)
            products = [p for p in results if p]
        self.log.info("%s – total %d products scraped (sitemap)", self.display_name, len(products))
        return products
