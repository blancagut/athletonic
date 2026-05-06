from scrapers.shopify import ShopifyScraper


class FifaStoreScraper(ShopifyScraper):
    brand_slug   = "fifa_store"
    display_name = "FIFA Official Store"
    base_url     = "https://store.fifa.com"