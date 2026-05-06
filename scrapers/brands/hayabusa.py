from scrapers.shopify import ShopifyScraper


class HayabusaScraper(ShopifyScraper):
    brand_slug   = "hayabusa"
    display_name = "Hayabusa"
    base_url     = "https://hayabusafight.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100