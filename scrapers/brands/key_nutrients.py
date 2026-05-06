"""Key Nutrients DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class KeyNutrientsScraper(ShopifyScraper):
    brand_slug = "key_nutrients"
    display_name = "Key Nutrients"
    base_url = "https://www.keynutrients.com"
