from scrapers.shopify import ShopifyScraper


class CoreNutritionalsScraper(ShopifyScraper):
    brand_slug   = "core_nutritionals"
    display_name = "Core Nutritionals"
    base_url     = "https://corenutritionals.com"
