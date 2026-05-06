from scrapers.shopify import ShopifyScraper


class RyseSupplementsScraper(ShopifyScraper):
    brand_slug   = "ryse_supplements"
    display_name = "Ryse Supplements"
    base_url     = "https://rysesupps.com"
