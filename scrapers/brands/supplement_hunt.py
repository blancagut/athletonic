from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class SupplementHuntScraper(RetailerVendorShopifyScraper):
    brand_slug   = "supplement_hunt"
    display_name = "Supplement Hunt"
    base_url     = "https://www.supplementhunt.com"

    # Exact vendor strings confirmed from the store's products.json
    brand_vendor_map = {
        "optimum_nutrition": ["optimum nutrition"],
        "dymatize":          ["dymatize"],
        "muscletech":        ["muscletech"],
        "bsn":               ["bsn"],
        "cellucor":          ["cellucor"],
        "myprotein":         ["myprotein"],
        "transparent_labs":  ["transparent labs"],
        "gorilla_mind":      ["gorilla mind"],
        "raw_nutrition":     ["raw nutrition"],
        "legion_athletics":  ["legion athletics"],
        "musclepharm":     ["musclepharm"],
        "bucked_up":         ["bucked up", "das labs"],
        "jym":               ["jym"],
        "animal_pak":        ["universal nutrition"],
    }
