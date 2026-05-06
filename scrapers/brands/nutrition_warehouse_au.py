from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class NutritionWarehouseScraper(RetailerVendorShopifyScraper):
    brand_slug   = "nutrition_warehouse_au"
    display_name = "Nutrition Warehouse AU"
    base_url     = "https://www.nutritionwarehouse.com.au"

    # Exact vendor strings confirmed from the store's products.json
    brand_vendor_map = {
        "optimum_nutrition": ["optimum nutrition"],
        "dymatize":          ["dymatize nutrition"],
        "muscletech":        ["muscletech"],
        "bsn":               ["bsn supplements"],
        "cellucor":          ["cellucor/c4 energy", "cellucor"],
        "myprotein":         ["myprotein"],
        "transparent_labs":  ["transparent labs"],
        "gorilla_mind":      ["gorilla mind"],
        "raw_nutrition":     ["raw nutrition"],
        "legion_athletics":  ["legion athletics"],
        "musclepharm":     ["muscle pharm"],
    }
