"""
Retailer Shopify scraper – scrapes multiple brand collections from one retailer.

Subclasses define:
  base_url             – e.g. "https://www.tigerfitness.com"
  display_name         – e.g. "Tiger Fitness"
  brand_collection_map – dict: brand_slug → collection handle
                         e.g. {"optimum_nutrition": "optimum-nutrition", ...}
"""
import asyncio
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import aiohttp

from config import DELAY_BETWEEN_PAGES, SHOPIFY_PAGE_LIMIT
from scrapers.shopify import ShopifyScraper
from utils.storage import upsert_product


class RetailerShopifyScraper(ShopifyScraper):
    """
    Shopify retailer scraper that iterates multiple brand collections
    and saves each product under its real brand slug.
    """

    brand_slug: str = "retailer"          # used only for logging fallback
    brand_collection_map: Dict[str, str] = {}  # brand_slug → collection handle

    def _collection_products_url(
        self,
        collection_handle: str,
        page: int = 1,
        page_info: Optional[str] = None,
    ) -> str:
        params: Dict[str, Any] = {"limit": SHOPIFY_PAGE_LIMIT}
        if page_info:
            params["page_info"] = page_info
        else:
            params["page"] = page
        base = self.base_url.rstrip("/")
        return f"{base}/collections/{collection_handle}/products.json?{urlencode(params)}"

    async def _scrape_brand_collection(
        self,
        session: aiohttp.ClientSession,
        brand_slug: str,
        collection_handle: str,
    ) -> List[Dict[str, Any]]:
        """Paginate through one collection and return all products for brand_slug."""
        products: List[Dict[str, Any]] = []
        page = 1
        next_url: Optional[str] = None

        while True:
            url = next_url or self._collection_products_url(collection_handle, page)
            self.log.debug("[%s] Fetching %s page %d → %s", brand_slug, collection_handle, page, url)

            try:
                data, next_url = await self._get_json(session, url)
            except Exception as exc:
                self.log.warning("[%s] Collection '%s' error: %s", brand_slug, collection_handle, exc)
                break

            raw_products = (data or {}).get("products", [])
            if not raw_products:
                break

            for raw in raw_products:
                product = self._parse_product(raw, brand_slug, self.base_url)
                # Mark retailer source so it doesn't clobber DTC data unintentionally
                product["product_id"] = f"{self.brand_slug}_{product['product_id']}"
                product["handle"]     = f"{product['handle']}"
                products.append(product)

            self.log.info(
                "[%s/%s] page %d → +%d products (running: %d)",
                self.display_name, brand_slug, page, len(raw_products), len(products),
            )

            if next_url:
                await asyncio.sleep(DELAY_BETWEEN_PAGES)
                page += 1
            elif len(raw_products) == SHOPIFY_PAGE_LIMIT:
                page += 1
                await asyncio.sleep(DELAY_BETWEEN_PAGES)
            else:
                break

        return products

    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape all brand collections and return combined product list."""
        all_products: List[Dict[str, Any]] = []

        async with aiohttp.ClientSession() as session:
            for brand_slug, collection_handle in self.brand_collection_map.items():
                self.log.info(
                    "[%s] Starting collection: %s → %s",
                    self.display_name, brand_slug, collection_handle,
                )
                products = await self._scrape_brand_collection(session, brand_slug, collection_handle)
                self.log.info(
                    "[%s] Done %s: %d products",
                    self.display_name, brand_slug, len(products),
                )
                all_products.extend(products)
                await asyncio.sleep(DELAY_BETWEEN_PAGES)

        return all_products

    async def run(self) -> List[Dict[str, Any]]:
        """Scrape + persist all products.  Brand slug comes from the product dict, not self."""
        self.log.info("[bold cyan]Starting[/bold cyan] %s …", self.display_name)
        products = await self.scrape()
        saved = 0
        for product in products:
            # brand is already set correctly in each product dict by _parse_product
            try:
                upsert_product(product)
                saved += 1
            except Exception as exc:
                self.log.error(
                    "DB error %s / %s: %s",
                    product.get("brand"), product.get("name"), exc,
                )
        self.log.info(
            "[bold green]Done[/bold green] %s – %d products saved",
            self.display_name, saved,
        )
        return products
