from scrapers.shopify import ShopifyScraper


class InnoSuppsScraper(ShopifyScraper):
    brand_slug   = "inno_supps"
    display_name = "Inno Supps"
    base_url     = "https://innosupps.com"
