"""MaryRuth Organics DTC scraper (Shopify API)."""
from scrapers.shopify import ShopifyScraper


class MaryruthOrganicsScraper(ShopifyScraper):
    brand_slug = "maryruth_organics"
    display_name = "MaryRuth Organics"
    base_url = "https://www.maryruthorganics.com"
