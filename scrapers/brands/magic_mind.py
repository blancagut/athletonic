"""Magic Mind DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class MagicMindScraper(ShopifyScraper):
    brand_slug = "magic_mind"
    display_name = "Magic Mind"
    base_url = "https://www.magicmind.com"
