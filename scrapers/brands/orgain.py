"""Orgain DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class OrgainScraper(ShopifyScraper):
    brand_slug = "orgain"
    display_name = "Orgain"
    base_url = "https://orgain.com"
