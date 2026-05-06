from scrapers.shopify import ShopifyScraper


class JymScraper(ShopifyScraper):
    brand_slug   = "jym"
    display_name = "JYM Supplement Science"
    # Without www — the www.* host returns 403 (bot blocking).
    base_url     = "https://jymsupplementscience.com"
