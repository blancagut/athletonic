"""Ample Foods DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class AmpleScraper(ShopifyScraper):
    brand_slug = "ample"
    display_name = "Ample"
    base_url = "https://amplemeal.com"
