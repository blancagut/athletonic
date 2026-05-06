"""Bodybuilding.com — major US sports supplement retailer (Shopify)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class BodybuildingComScraper(RetailerVendorShopifyScraper):
    brand_slug   = "bodybuilding_com"
    display_name = "Bodybuilding.com (retailer fan-out)"
    base_url     = "https://www.bodybuilding.com"

    brand_vendor_map = {
        "kaged":              ["kaged"],
        "alpha_lion":         ["alpha lion"],
        "cellucor":           ["cellucor"],
        "axe_sledge":         ["axe & sledge", "axe and sledge"],
        "redcon1":            ["redcon1"],
        "raw_nutrition":      ["raw nutrition"],
        "ryse_supplements":   ["ryse"],
        "dymatize":           ["dymatize"],
        "bucked_up":          ["bucked up"],
        "jym":                ["jym supplement science", "jym"],
        "animal_pak":         ["animal"],
    }
