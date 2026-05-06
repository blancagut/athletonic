"""Supplement Warehouse retailer scraper (Shopify full catalog + brand matching)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class SupplementWarehouseScraper(RetailerVendorShopifyScraper):
    brand_slug = "supplement_warehouse"
    display_name = "Supplement Warehouse"
    base_url = "https://www.supplementwarehouse.com"

    brand_vendor_map = {
        "optimum_nutrition": ["optimum nutrition"],
        "dymatize": ["dymatize"],
        "transparent_labs": ["transparent labs"],
        "raw_nutrition": ["raw nutrition"],
        "legion_athletics": ["legion athletics"],
        "gorilla_mind": ["gorilla mind"],
        "muscletech": ["muscletech", "muscle tech"],
        "bsn": ["bsn"],
        "cellucor": ["cellucor", "c4"],
        "myprotein": ["myprotein", "my protein"],
        "bucked_up": ["bucked up"],
        "animal_pak": ["universal"],
    }
