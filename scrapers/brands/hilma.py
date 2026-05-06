"""Hilma DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class HilmaScraper(ShopifyScraper):
    brand_slug = "hilma"
    display_name = "Hilma"
    base_url = "https://hilma.co"
