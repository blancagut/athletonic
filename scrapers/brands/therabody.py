"""Therabody DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class TherabodyScraper(ShopifyScraper):
    brand_slug = "therabody"
    display_name = "Therabody"
    base_url = "https://www.therabody.com"
