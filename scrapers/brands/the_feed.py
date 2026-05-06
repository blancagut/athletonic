"""The Feed — premium endurance/wellness supplements retailer (Shopify)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class TheFeedScraper(RetailerVendorShopifyScraper):
    brand_slug   = "the_feed"
    display_name = "The Feed (retailer fan-out)"
    base_url     = "https://www.thefeed.com"

    # Vendor strings confirmed from live products.json. Using lowercased substring
    # match via the base class (\b word boundary).
    brand_vendor_map = {
        "thorne":              ["thorne"],
        "momentous":           ["momentous"],
        "transparent_labs":    ["transparent labs"],
        "therabody":           ["therabody"],
        "promix":              ["promix"],
        "hyperice":            ["hyperice"],
        "pure_encapsulations": ["pure encapsulations"],
        "bare_performance":    ["bare performance nutrition"],
        "cymbiotika":          ["cymbiotika"],
        "nordic_naturals":     ["nordic naturals"],
        "raw_nutrition":       ["raw nutrition"],
        "myprotein":           ["myprotein"],
        "skratch_labs":        ["skratch labs"],
        "onnit":               ["onnit"],
        "nuun":                ["nuun"],
        "vital_proteins":      ["vital proteins"],
        "novos_labs":          ["novos"],
        "magic_mind":          ["magic mind"],
        "liquid_iv":           ["liquid iv"],
        "tru_niagen":          ["tru niagen"],
        # NOTE: Optimum Nutrition vendor here is "OPTIMUM NUTRITION®". The base
        # matcher word-boundary regex won't match the ® char gracefully, so use
        # the simpler "optimum nutrition" needle (substring within lowered).
        "optimum_nutrition":   ["optimum nutrition"],
        "huel":                ["huel"],
        "lmnt":                ["lmnt"],
    }
