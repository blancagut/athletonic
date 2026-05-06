"""Renue By Science DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class RenueByScienceScraper(ShopifyScraper):
    brand_slug = "renue_by_science"
    display_name = "Renue By Science"
    base_url = "https://renuebyscience.com"
