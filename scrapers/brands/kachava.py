from scrapers.shopify import ShopifyScraper


class KachavaScraper(ShopifyScraper):
    brand_slug   = "kachava"
    display_name = "Ka'Chava"
    # Apex domain works; www is bot-blocked.
    base_url     = "https://kachava.com"
