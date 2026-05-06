"""Suppz retailer scraper (Shopify full catalog + brand matching)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class SuppzScraper(RetailerVendorShopifyScraper):
    brand_slug   = "suppz"
    display_name = "Suppz"
    base_url     = "https://www.suppz.com"

    brand_vendor_map = {
        "optimum_nutrition": ["optimum nutrition"],
        "dymatize":          ["dymatize"],
        "muscletech":        ["muscletech", "muscle tech"],
        "bsn":               ["bsn"],
        "cellucor":          ["cellucor", "c4"],
        "myprotein":         ["myprotein"],
        "transparent_labs":  ["transparent labs"],
        "gorilla_mind":      ["gorilla mind"],
        "raw_nutrition":     ["raw nutrition"],
        "musclepharm":       ["musclepharm"],
        "bucked_up":         ["bucked up", "bucked"],
        "animal_pak":        ["universal nutrition", "animal pak", "animal | universal"],
    }
