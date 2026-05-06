"""Tru Niagen DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class TruNiagenScraper(ShopifyScraper):
    brand_slug = "tru_niagen"
    display_name = "Tru Niagen"
    base_url = "https://www.truniagen.com"
