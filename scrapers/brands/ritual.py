"""Ritual DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class RitualScraper(ShopifyScraper):
    brand_slug = "ritual"
    display_name = "Ritual"
    base_url = "https://ritual.com"
