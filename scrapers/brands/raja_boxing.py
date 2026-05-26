from scrapers.woocommerce import WooCommerceScraper


class RajaBoxingScraper(WooCommerceScraper):
    brand_slug   = "raja_boxing"
    display_name = "Raja Boxing"
    base_url     = "https://www.rajaboxing.com"
    page_size    = 100          # full catalog: gloves, shorts, pads, shin guards, apparel
