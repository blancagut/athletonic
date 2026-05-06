"""Liquid I.V. DTC scraper (Shopify Hydrogen — sitemap-driven)."""
from scrapers.shopify_hydrogen import HydrogenShopifyScraper


class LiquidIVScraper(HydrogenShopifyScraper):
    brand_slug = "liquid_iv"
    display_name = "Liquid I.V."
    base_url = "https://www.liquid-iv.com"
