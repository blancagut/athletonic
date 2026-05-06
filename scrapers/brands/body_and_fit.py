"""Body and Fit retailer scraper (Shopify full catalog + brand matching)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class BodyAndFitScraper(RetailerVendorShopifyScraper):
    brand_slug = "body_and_fit"
    display_name = "Body and Fit"
    base_url = "https://www.bodyandfit.com"

    brand_vendor_map = {
        "optimum_nutrition": ["optimum nutrition"],
        "dymatize": ["dymatize"],
        "muscletech": ["muscletech", "muscle tech"],
        "bsn": ["bsn"],
        "cellucor": ["cellucor", "c4"],
    }
