"""Soylent DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class SoylentScraper(ShopifyScraper):
    brand_slug = "soylent"
    display_name = "Soylent"
    base_url = "https://soylent.com"
