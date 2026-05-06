from scrapers.shopify import ShopifyScraper


class QuestNutritionScraper(ShopifyScraper):
    brand_slug   = "quest_nutrition"
    display_name = "Quest Nutrition"
    base_url     = "https://www.questnutrition.com"
