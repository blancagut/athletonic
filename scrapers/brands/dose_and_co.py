from scrapers.shopify import ShopifyScraper


class DoseAndCoScraper(ShopifyScraper):
    brand_slug   = "dose_and_co"
    display_name = "Dose & Co"
    base_url     = "https://doseandco.com"