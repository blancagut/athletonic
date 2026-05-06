"""Manta Sleep DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class MantaSleepScraper(ShopifyScraper):
    brand_slug = "manta_sleep"
    display_name = "Manta Sleep"
    base_url = "https://mantasleep.com"
