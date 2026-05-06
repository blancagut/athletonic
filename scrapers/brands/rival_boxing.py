from scrapers.shopify import ShopifyScraper


class RivalBoxingScraper(ShopifyScraper):
    brand_slug   = "rival_boxing"
    display_name = "Rival Boxing"
    base_url     = "https://rivalboxing.us"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100