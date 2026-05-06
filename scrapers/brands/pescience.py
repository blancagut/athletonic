from scrapers.shopify import ShopifyScraper


class PescienceScraper(ShopifyScraper):
    brand_slug   = "pescience"
    display_name = "PEScience"
    base_url     = "https://pescience.com"
