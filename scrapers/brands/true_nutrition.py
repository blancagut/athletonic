"""True Nutrition DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class TrueNutritionScraper(ShopifyScraper):
    brand_slug = "true_nutrition"
    display_name = "True Nutrition"
    base_url = "https://www.truenutrition.com"
