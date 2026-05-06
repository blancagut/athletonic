"""Elysium Health DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class ElysiumScraper(ShopifyScraper):
    brand_slug = "elysium"
    display_name = "Elysium Health"
    base_url = "https://www.elysiumhealth.com"
