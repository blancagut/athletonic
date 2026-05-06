"""Onnit DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class OnnitScraper(ShopifyScraper):
    brand_slug = "onnit"
    display_name = "Onnit"
    base_url = "https://www.onnit.com"
