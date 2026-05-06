from scrapers.shopify import ShopifyScraper


class FootballTownScraper(ShopifyScraper):
    brand_slug   = "football_town"
    display_name = "Football Town"
    base_url     = "https://footballtown.com"