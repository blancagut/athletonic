"""Navitas Organics DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class NavitasOrganicsScraper(ShopifyScraper):
    brand_slug = "navitas_organics"
    display_name = "Navitas Organics"
    base_url = "https://navitasorganics.com"
