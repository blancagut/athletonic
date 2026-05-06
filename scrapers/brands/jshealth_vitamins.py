from scrapers.shopify import ShopifyScraper


class JshealthVitaminsScraper(ShopifyScraper):
    brand_slug   = "jshealth_vitamins"
    display_name = "JSHealth Vitamins"
    base_url     = "https://us.jshealthvitamins.com"