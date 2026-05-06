"""
Swanson Vitamins — retailer-vendor scraper.

Pulls the entire Swanson products.json catalog and reassigns each product
to one of 6 target brands by exact vendor name match. Used to obtain
catalogs from brands that block direct DTC scraping:

    - Garden of Life      (Cloudflare-blocked DTC)
    - Thorne              (custom SPA, no API)
    - Nordic Naturals     (Gatsby SPA, hidden catalog)
    - NOW Foods           (Cloudflare-blocked DTC)
    - Centrum             (no product API)
    - Pure Encapsulations (practitioner-locked Shopify)

Each product's `brand` is set to the target slug (e.g. "garden_of_life"),
so storage routes them under their own brand identity even though they were
sourced from swansonvitamins.com.
"""
from typing import Dict, Optional

from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class SwansonRetailerScraper(RetailerVendorShopifyScraper):
    brand_slug   = "swanson_retailer"
    display_name = "Swanson Vitamins (retailer fan-out)"
    base_url     = "https://www.swansonvitamins.com"

    # Strict vendor-equality map: target brand slug -> exact vendor string in Swanson's
    # products.json. Vendor matching only (no name/tag fuzzy match) to prevent
    # cross-brand contamination from comparison phrases like "alternative to Centrum".
    vendor_to_brand: Dict[str, str] = {
        "Garden of Life":      "garden_of_life",
        "Thorne":              "thorne",
        "Nordic Naturals":     "nordic_naturals",
        "Pure Encapsulations": "pure_encapsulations",
        "Centrum":             "centrum",
        "NOW Foods":           "now_foods",
    }

    # Required by base class but unused (we override _match_brand below).
    brand_vendor_map = {
        slug: [vendor] for vendor, slug in vendor_to_brand.items()
    }

    def _match_brand(self, product: Dict) -> Optional[str]:
        vendor = (product.get("vendor") or "").strip()
        return self.vendor_to_brand.get(vendor)

