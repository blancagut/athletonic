"""Vega DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class VegaScraper(ShopifyScraper):
    brand_slug = "vega"
    display_name = "Vega"
    base_url = "https://myvega.com"
