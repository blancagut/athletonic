from scrapers.shopify import ShopifyScraper


class SoccerPostScraper(ShopifyScraper):
    brand_slug   = "soccer_post"
    display_name = "Soccer Post"
    base_url     = "https://soccerpost.com"