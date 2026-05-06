from scrapers.shopify import ShopifyScraper


class TruvaniScraper(ShopifyScraper):
    brand_slug   = "truvani"
    display_name = "Truvani"
    # Main www.truvani.com is a Next.js storefront with products.json blocked,
    # but the Shopify backend at shop.truvani.com is fully open.
    base_url     = "https://shop.truvani.com"
