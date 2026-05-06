from scrapers.shopify import ShopifyScraper


class NuzestScraper(ShopifyScraper):
    brand_slug   = "nuzest"
    display_name = "Nuzest"
    base_url     = "https://www.nuzest-usa.com"
