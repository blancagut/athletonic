from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class NZMuscleScraper(RetailerVendorShopifyScraper):
    brand_slug   = "nz_muscle"
    display_name = "NZ Muscle"
    base_url     = "https://www.nzmuscle.co.nz"

    # Exact vendor strings confirmed from the store's products.json
    brand_vendor_map = {
        "optimum_nutrition": ["optimum nutrition"],
        "dymatize":          ["dymatize nutrition"],
        "muscletech":        ["muscletech"],
        "bsn":               ["bsn"],
        "cellucor":          ["cellucor"],
        "myprotein":         ["myprotein"],
        "transparent_labs":  ["transparent labs"],
        "gorilla_mind":      ["gorilla mind"],
        "raw_nutrition":     ["raw nutrition"],
        "legion_athletics":  ["legion athletics"],
        "musclepharm":     ["musclepharm"],
    }
