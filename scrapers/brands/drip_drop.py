"""DripDrop DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class DripDropScraper(ShopifyScraper):
    brand_slug = "drip_drop"
    display_name = "DripDrop"
    base_url = "https://www.dripdrop.com"
