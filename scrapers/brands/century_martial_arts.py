from scrapers.shopify import ShopifyScraper


class CenturyMartialArtsScraper(ShopifyScraper):
    brand_slug   = "century_martial_arts"
    display_name = "Century Martial Arts"
    base_url     = "https://www.centurymartialarts.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100