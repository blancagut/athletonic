"""Discount Supplements UK — UK sports supplement retailer (Shopify)."""
from scrapers.retailer_vendor_shopify import RetailerVendorShopifyScraper


class DiscountSupplementsUkScraper(RetailerVendorShopifyScraper):
    brand_slug   = "discount_supplements_uk"
    display_name = "Discount Supplements UK (retailer fan-out)"
    base_url     = "https://www.discount-supplements.co.uk"

    brand_vendor_map = {
        "optimum_nutrition":  ["optimum nutrition"],
        "bsn":                ["bsn"],
        "animal_pak":         ["animal"],
    }
