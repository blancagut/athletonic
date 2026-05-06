from scrapers.shopify import ShopifyScraper


class FivePercentNutritionScraper(ShopifyScraper):
    brand_slug   = "five_percent_nutrition"
    display_name = "5% Nutrition"
    base_url     = "https://5percentnutrition.com"
