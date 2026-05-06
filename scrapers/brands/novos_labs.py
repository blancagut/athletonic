"""NOVOS Labs DTC scraper (WooCommerce)."""
from scrapers.woocommerce import WooCommerceScraper


class NovosLabsScraper(WooCommerceScraper):
    brand_slug = "novos_labs"
    display_name = "NOVOS Labs"
    base_url = "https://novoslabs.com"
