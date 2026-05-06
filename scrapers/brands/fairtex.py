from scrapers.shopify import ShopifyScraper


class FairtexScraper(ShopifyScraper):
    brand_slug   = "fairtex"
    display_name = "Fairtex"
    base_url     = "https://www.fairtex.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100