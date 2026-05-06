"""KOS DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class KosScraper(ShopifyScraper):
    brand_slug = "kos"
    display_name = "KOS"
    base_url = "https://kos.com"
