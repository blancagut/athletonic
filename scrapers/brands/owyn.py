"""OWYN DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class OwynScraper(ShopifyScraper):
    brand_slug = "owyn"
    display_name = "OWYN"
    base_url = "https://liveowyn.com"
