"""Nuun DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class NuunScraper(ShopifyScraper):
    brand_slug = "nuun"
    display_name = "Nuun"
    base_url = "https://nuunlife.com"
