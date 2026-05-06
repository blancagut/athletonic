from scrapers.shopify import ShopifyScraper


class VenumScraper(ShopifyScraper):
    brand_slug   = "venum"
    display_name = "Venum"
    base_url     = "https://www.venum.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100