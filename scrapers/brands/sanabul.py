from scrapers.shopify import ShopifyScraper


class SanabulScraper(ShopifyScraper):
    brand_slug   = "sanabul"
    display_name = "Sanabul"
    base_url     = "https://sanabulsports.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100