"""Compex DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class CompexScraper(ShopifyScraper):
    brand_slug = "compex"
    display_name = "Compex"
    base_url = "https://www.compex.com"
