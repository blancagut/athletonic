"""Cymbiotika DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class CymbiotikaScraper(ShopifyScraper):
    brand_slug = "cymbiotika"
    display_name = "Cymbiotika"
    base_url = "https://cymbiotika.com"
