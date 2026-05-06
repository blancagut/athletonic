"""Skratch Labs DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class SkratchLabsScraper(ShopifyScraper):
    brand_slug = "skratch_labs"
    display_name = "Skratch Labs"
    base_url = "https://www.skratchlabs.com"
