from scrapers.shopify import ShopifyScraper


class BloomNutritionScraper(ShopifyScraper):
    brand_slug   = "bloom_nutrition"
    display_name = "Bloom Nutrition"
    base_url     = "https://bloomnu.com"
