from scrapers.shopify import ShopifyScraper


class RawNutritionScraper(ShopifyScraper):
    brand_slug   = "raw_nutrition"
    display_name = "RAW Nutrition"
    base_url     = "https://www.getrawnutrition.com"
