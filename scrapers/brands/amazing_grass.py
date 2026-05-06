"""Amazing Grass DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class AmazingGrassScraper(ShopifyScraper):
    brand_slug = "amazing_grass"
    display_name = "Amazing Grass"
    base_url = "https://www.amazinggrass.com"
