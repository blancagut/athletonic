from scrapers.shopify import ShopifyScraper


class EverlastScraper(ShopifyScraper):
    brand_slug   = "everlast"
    display_name = "Everlast"
    base_url     = "https://www.everlast.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100