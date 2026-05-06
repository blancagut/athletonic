from scrapers.shopify import ShopifyScraper


class AwayDaysScraper(ShopifyScraper):
    brand_slug   = "away_days"
    display_name = "Away Days"
    base_url     = "https://awaydaysfootball.com"