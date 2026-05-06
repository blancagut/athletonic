from scrapers.shopify import ShopifyScraper


class AllbirdsScraper(ShopifyScraper):
    brand_slug   = "allbirds"
    display_name = "Allbirds"
    base_url     = "https://www.allbirds.com"