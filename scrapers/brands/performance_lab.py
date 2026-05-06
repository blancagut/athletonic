"""Performance Lab DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class PerformanceLabScraper(ShopifyScraper):
    brand_slug = "performance_lab"
    display_name = "Performance Lab"
    base_url = "https://www.performancelab.com"
