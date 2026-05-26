from scrapers.shopify import ShopifyScraper


class WindyScraper(ShopifyScraper):
    brand_slug   = "windy"
    display_name = "Windy Fight Gear USA"
    base_url     = "https://www.windyfightgearusa.com"
    max_products = None          # fetch entire catalog

    def __init__(self) -> None:
        super().__init__()
        # windyfightgearusa.com has a self-signed / mismatched SSL cert;
        # disable verification so the scraper can reach the store.
        self._ssl_ctx = False
