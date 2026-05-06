from scrapers.shopify import ShopifyScraper


class NeededScraper(ShopifyScraper):
    brand_slug   = "needed"
    display_name = "Needed"
    base_url     = "https://thisisneeded.com"