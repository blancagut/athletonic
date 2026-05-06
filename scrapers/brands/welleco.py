from scrapers.shopify import ShopifyScraper


class WellecoScraper(ShopifyScraper):
    brand_slug   = "welleco"
    display_name = "WelleCo"
    base_url     = "https://welleco.com"