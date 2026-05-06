from scrapers.shopify import ShopifyScraper


class MoonJuiceScraper(ShopifyScraper):
    brand_slug   = "moon_juice"
    display_name = "Moon Juice"
    base_url     = "https://www.moonjuice.com"