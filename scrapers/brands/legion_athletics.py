"""
Legion Athletics scraper – Playwright (Shopify /products.json is 403-blocked).
Navigates the /collections/all catalog pages and extracts product data
from Shopify's embedded JSON-LD and product page HTML.
"""
import asyncio
import json
import re
from typing import Any, Dict, List, Optional

from playwright.async_api import async_playwright, Page, BrowserContext, TimeoutError as PlaywrightTimeoutError

from config import BROWSER_HEADLESS, BROWSER_TIMEOUT_MS, DELAY_BETWEEN_PAGES, USER_AGENT
from scrapers.base import BaseScraper


_COLLECTIONS_URL = "https://legionathletics.com/collections/all"
_PRODUCT_URL_RE  = re.compile(r"legionathletics\.com/products/[^\"'\s]+")


async def _safe_text(page: Page, selector: str) -> str:
    try:
        el = await page.query_selector(selector)
        return (await el.inner_text()).strip() if el else ""
    except Exception:
        return ""


async def _extract_jsonld(page: Page) -> Optional[Dict]:
    """Extract product data from JSON-LD script tag."""
    try:
        scripts = await page.query_selector_all('script[type="application/ld+json"]')
        for script in scripts:
            content = await script.inner_text()
            data    = json.loads(content)
            items   = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Product":
                    return item
    except Exception:
        pass
    return None


async def _extract_shopify_product_json(page: Page) -> Optional[Dict]:
    """Shopify stores embed product data in a <script> with var meta = {…}
    or window.ShopifyAnalytics.meta.product."""
    try:
        # Try the /products/{handle}.json endpoint via the page URL
        url = page.url.rstrip("/") + ".json"
        resp = await page.request.get(url)
        if resp.ok:
            data = await resp.json()
            return data.get("product")
    except Exception:
        pass
    return None


async def _scrape_product_page(context: BrowserContext, url: str, brand_slug: str) -> Optional[Dict]:
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=BROWSER_TIMEOUT_MS)
        await asyncio.sleep(1.5)

        # Try fastest path: JSON endpoint
        shopify_data = await _extract_shopify_product_json(page)
        if shopify_data:
            await page.close()
            return _parse_shopify_product_json(shopify_data, brand_slug, "https://legionathletics.com")

        # Fallback: JSON-LD
        jsonld = await _extract_jsonld(page)

        title = await _safe_text(page, "h1")
        if not title:
            title = await _safe_text(page, ".product__title")

        desc_el = await page.query_selector(".product__description, [data-product-description], .product-description")
        desc    = (await desc_el.inner_html()).strip() if desc_el else ""

        # Price
        price_text = await _safe_text(page, ".price__current, .product__price, [data-product-price]")
        price = _parse_price(price_text)

        # Images
        images = []
        img_els = await page.query_selector_all(".product__media img, .product-image img, .product__photo img")
        seen_urls: set = set()
        for img_el in img_els:
            src = await img_el.get_attribute("src") or await img_el.get_attribute("data-src") or ""
            src = src.split("?")[0]
            if src and src not in seen_urls and not src.endswith(".svg"):
                # ensure absolute
                if src.startswith("//"):
                    src = "https:" + src
                seen_urls.add(src)
                images.append({"url": src, "alt": await img_el.get_attribute("alt"), "local_path": None})

        handle = url.rstrip("/").split("/products/")[-1].split("?")[0]
        product_id = jsonld.get("sku") or handle if jsonld else handle

        return {
            "brand":            brand_slug,
            "product_id":       product_id,
            "name":             title or (jsonld.get("name") if jsonld else ""),
            "handle":           handle,
            "url":              url,
            "description_html": desc,
            "price":            price or (jsonld_price(jsonld) if jsonld else None),
            "currency":         "USD",
            "images":           images,
            "variants":         [],
            "tags":             [],
            "options":          [],
        }
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Error scraping %s: %s", url, exc)
        return None
    finally:
        await page.close()


def _parse_shopify_product_json(raw: Dict, brand_slug: str, base_url: str) -> Dict:
    from scrapers.shopify import ShopifyScraper
    return ShopifyScraper._parse_product(raw, brand_slug, base_url)


def jsonld_price(jsonld: Dict) -> Optional[float]:
    try:
        offers = jsonld.get("offers", {})
        if isinstance(offers, list):
            offers = offers[0]
        return float(offers.get("price", 0)) or None
    except Exception:
        return None


def _parse_price(text: str) -> Optional[float]:
    match = re.search(r"[\d,]+\.?\d*", text.replace(",", ""))
    return float(match.group()) if match else None


class LegionAthleticsScraper(BaseScraper):
    brand_slug   = "legion_athletics"
    display_name = "Legion Athletics"
    base_url     = "https://legionathletics.com"

    async def scrape(self) -> List[Dict[str, Any]]:
        product_urls: List[str] = []
        products: List[Dict]    = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=BROWSER_HEADLESS)
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 800},
            )

            # ── collect all product URLs from collection pages ──────────────
            page = await context.new_page()
            current_url: Optional[str] = _COLLECTIONS_URL

            while current_url:
                self.log.info("Collecting products from: %s", current_url)
                try:
                    await page.goto(current_url, wait_until="networkidle", timeout=BROWSER_TIMEOUT_MS)
                except PlaywrightTimeoutError:
                    # Some storefront pages keep background requests open forever.
                    await page.goto(current_url, wait_until="domcontentloaded", timeout=BROWSER_TIMEOUT_MS)
                await asyncio.sleep(2.5)

                # Extract product links
                links = await page.query_selector_all('a[href*="/products/"]')
                page_hrefs: set = set()
                for link in links:
                    href = await link.get_attribute("href") or ""
                    if "/products/" in href and not href.endswith("/products/"):
                        if href.startswith("/"):
                            href = self.base_url + href
                        page_hrefs.add(href.split("?")[0])

                # Fallback: parse product URLs from raw page HTML when anchors are JS-rendered.
                if not page_hrefs:
                    html = await page.content()
                    for match in _PRODUCT_URL_RE.findall(html):
                        href = match.split("?")[0]
                        if href.startswith("http"):
                            page_hrefs.add(href)
                        else:
                            page_hrefs.add(f"https://{href.lstrip('/')}")

                new_count = 0
                for href in page_hrefs:
                    if href not in product_urls:
                        product_urls.append(href)
                        new_count += 1
                self.log.info("  Found %d new product URLs (total: %d)", new_count, len(product_urls))

                # Next page
                next_el = await page.query_selector(
                    'a[href*="page="]:has-text("Next"), '
                    '.pagination__next, '
                    'a[aria-label="Next page"], '
                    'link[rel="next"]'
                )
                if next_el:
                    next_href = await next_el.get_attribute("href") or ""
                    current_url = (self.base_url + next_href) if next_href.startswith("/") else next_href or None
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                else:
                    current_url = None

            await page.close()

            # ── scrape each product page ────────────────────────────────────
            self.log.info("Scraping %d product pages …", len(product_urls))
            semaphore = asyncio.Semaphore(4)

            async def bounded_scrape(url: str) -> Optional[Dict]:
                async with semaphore:
                    result = await _scrape_product_page(context, url, self.brand_slug)
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                    return result

            results = await asyncio.gather(*[bounded_scrape(u) for u in product_urls])
            products = [r for r in results if r]

            await browser.close()

        return products
