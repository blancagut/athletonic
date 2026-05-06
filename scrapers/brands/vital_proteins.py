from scrapers.shopify import ShopifyScraper


class VitalProteinsScraper(ShopifyScraper):
    brand_slug   = "vital_proteins"
    display_name = "Vital Proteins"
    base_url     = "https://www.vitalproteins.com"
