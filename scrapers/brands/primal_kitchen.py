from scrapers.shopify import ShopifyScraper


class PrimalKitchenScraper(ShopifyScraper):
    brand_slug   = "primal_kitchen"
    display_name = "Primal Kitchen"
    base_url     = "https://www.primalkitchen.com"
