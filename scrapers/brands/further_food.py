from scrapers.shopify import ShopifyScraper


class FurtherFoodScraper(ShopifyScraper):
    brand_slug   = "further_food"
    display_name = "Further Food"
    base_url     = "https://www.furtherfood.com"