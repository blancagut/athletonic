from scrapers.shopify import ShopifyScraper


class RdxSportsScraper(ShopifyScraper):
    brand_slug   = "rdx_sports"
    display_name = "RDX Sports"
    base_url     = "https://rdxsports.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100
