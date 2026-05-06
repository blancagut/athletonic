"""Shopify retailer scraper that maps products to target brands via vendor matching."""
import re
from typing import Dict, List, Optional

from scrapers.shopify import ShopifyScraper


class RetailerVendorShopifyScraper(ShopifyScraper):
    """
    Scrapes an entire Shopify retailer catalog once, then assigns products
    to one of the 10 target brand slugs using vendor/name/tag matching.
    """

    brand_vendor_map: Dict[str, List[str]] = {}

    def _match_brand(self, product: Dict) -> Optional[str]:
        vendor = (product.get("vendor") or "").strip().lower()
        name = (product.get("name") or "").strip().lower()
        tags = " ".join(product.get("tags") or []).lower()
        haystack = f"{vendor} || {name} || {tags}"

        for brand_slug, needles in self.brand_vendor_map.items():
            for needle in needles:
                n = needle.lower().strip()
                if not n:
                    continue
                pattern = rf"\b{re.escape(n)}\b"
                if re.search(pattern, haystack):
                    return brand_slug
        return None

    async def scrape(self) -> List[Dict]:
        raw_products = await super().scrape()
        filtered: List[Dict] = []

        for product in raw_products:
            matched_brand = self._match_brand(product)
            if not matched_brand:
                continue

            # Keep source uniqueness across DTC + retailers.
            product["brand"] = matched_brand
            product["product_id"] = f"{self.brand_slug}_{product.get('product_id', '')}"
            filtered.append(product)

        self.log.info(
            "[%s] Matched %d / %d products to target brands",
            self.display_name,
            len(filtered),
            len(raw_products),
        )
        return filtered
