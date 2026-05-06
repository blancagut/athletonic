"""Terrasoul Superfoods DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class TerrasoulSuperfoodsScraper(ShopifyScraper):
    brand_slug = "terrasoul_superfoods"
    display_name = "Terrasoul Superfoods"
    base_url = "https://terrasoul.com"
