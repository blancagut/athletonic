from scrapers.shopify import ShopifyScraper


class AnimalPakScraper(ShopifyScraper):
    brand_slug   = "animal_pak"
    display_name = "Animal (Universal Nutrition)"
    base_url     = "https://animalpak.com"
