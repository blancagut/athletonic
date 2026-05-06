"""Tiger Fitness retailer scraper (Shopify full catalog + brand matching)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class TigerFitnessScraper(RetailerVendorShopifyScraper):
    brand_slug = "tiger_fitness"
    display_name = "Tiger Fitness"
    base_url = "https://www.tigerfitness.com"

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
        "musclepharm": ["musclepharm"],
        "bucked_up": ["bucked up"],
        "animal_pak": ["animal | universal nutrition", "animal | universal"],
    }
