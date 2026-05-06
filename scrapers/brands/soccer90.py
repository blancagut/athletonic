from scrapers.shopify import ShopifyScraper


class Soccer90Scraper(ShopifyScraper):
    brand_slug   = "soccer90"
    display_name = "Soccer90"
    base_url     = "https://soccer90.com"