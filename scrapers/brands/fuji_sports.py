from scrapers.shopify import ShopifyScraper


class FujiSportsScraper(ShopifyScraper):
    brand_slug   = "fuji_sports"
    display_name = "Fuji Sports"
    base_url     = "https://fujisports.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100