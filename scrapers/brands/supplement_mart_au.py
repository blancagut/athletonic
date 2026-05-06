"""Supplement Mart AU — Australian sports supplement retailer (Shopify)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class SupplementMartAuScraper(RetailerVendorShopifyScraper):
    brand_slug   = "supplement_mart_au"
    display_name = "Supplement Mart AU (retailer fan-out)"
    base_url     = "https://supplementmart.com.au"

    brand_vendor_map = {
        "optimum_nutrition":  ["optimum nutrition"],
        "muscletech":         ["muscletech", "muscle tech"],
        "ghost_lifestyle":    ["ghost"],
        "cellucor":           ["cellucor"],
        "bsn":                ["bsn"],
        "redcon1":            ["redcon1"],
        "axe_sledge":         ["axe and sledge", "axe & sledge"],
        "ryse_supplements":   ["ryse"],
        "dymatize":           ["dymatize"],
        "nuzest":             ["nuzest"],
        "bucked_up":          ["bucked up"],
        "animal_pak":         ["universal nutrition"],
        "sunwarrior":         ["sunwarrior"],
    }
