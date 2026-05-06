"""Supplement Source CA — Canadian supplement retailer (Shopify)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class SupplementSourceCaScraper(RetailerVendorShopifyScraper):
    brand_slug   = "supplement_source_ca"
    display_name = "Supplement Source CA (retailer fan-out)"
    base_url     = "https://supplementsource.ca"

    brand_vendor_map = {
        "vega":               ["iron vegan", "confident vegan", "vega"],
        "now_foods":          ["now foods"],
        "cellucor":           ["cellucor"],
        "optimum_nutrition":  ["optimum nutrition"],
        "dymatize":           ["dymatize"],
        "bsn":                ["bsn"],
        "myprotein":          ["myprotein"],
        "redcon1":            ["redcon1"],
        "ryse_supplements":   ["ryse"],
        "therabody":          ["therabody"],
        "bucked_up":          ["bucked up"],
        "animal_pak":         ["animal"],
    }
