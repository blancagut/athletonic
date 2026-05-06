"""Hyperice DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class HypericeScraper(ShopifyScraper):
    brand_slug = "hyperice"
    display_name = "Hyperice"
    base_url = "https://hyperice.com"
