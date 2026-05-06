"""Nested Naturals DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class NestedNaturalsScraper(ShopifyScraper):
    brand_slug = "nested_naturals"
    display_name = "Nested Naturals"
    base_url = "https://www.nestednaturals.com"
