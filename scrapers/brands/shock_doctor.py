from scrapers.shopify import ShopifyScraper


class ShockDoctorScraper(ShopifyScraper):
    brand_slug   = "shock_doctor"
    display_name = "Shock Doctor"
    base_url     = "https://www.shockdoctor.com"
    collection_handle = "all"
    sort_by = "best-selling"
    max_products = 100