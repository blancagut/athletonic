from scrapers.shopify import ShopifyScraper


class MusclePharmScraper(ShopifyScraper):
    brand_slug   = "musclepharm"
    display_name = "MusclePharm"
    base_url     = "https://www.musclepharm.com"