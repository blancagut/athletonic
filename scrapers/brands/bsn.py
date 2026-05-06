"""
BSN (Bio-Engineered Supplements) scraper – Playwright.
BSN is owned by Glanbia and uses a custom e-commerce platform.
"""
import asyncio
import json
import re
from typing import Any, Dict, List, Optional

from playwright.async_api import async_playwright, BrowserContext, Page

from config import BROWSER_HEADLESS, BROWSER_TIMEOUT_MS, DELAY_BETWEEN_PAGES, USER_AGENT
from scrapers.base import BaseScraper

_COLLECTIONS_URL = "https://www.bsnsupplements.com/collections/all-products"


def _parse_price(text: str) -> Optional[float]:
    match = re.search(r"[\d,]+\.?\d*", text.replace(",", ""))
    return float(match.group()) if match else None


async def _scrape_bsn_product(context: BrowserContext, url: str, brand_slug: str) -> Optional[Dict]:
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=BROWSER_TIMEOUT_MS)
        await asyncio.sleep(1.5)

        # Try Shopify product.json path (BSN may be on Shopify)
        try:
            json_url = url.rstrip("/") + ".json"
            resp = await page.request.get(json_url)
            if resp.ok:
                data = await resp.json()
                raw  = data.get("product", {})
                if raw:
                    await page.close()
                    from scrapers.shopify import ShopifyScraper
                    return ShopifyScraper._parse_product(raw, brand_slug, "https://www.bsnsupplements.com")
        except Exception:
            pass

        # HTML fallback
        title = ""
        for sel in ("h1.product-title", "h1.product__title", "h1", ".product-name"):
            try:
                el = await page.query_selector(sel)
                if el:
                    title = (await el.inner_text()).strip()
                    break
            except Exception:
                pass

        desc_el = await page.query_selector(".product-description, .product__description, [class*='description']")
        desc    = (await desc_el.inner_html()).strip() if desc_el else ""

        price_text = ""
        for sel in (".price", ".product-price", "[class*='price']"):
            try:
                el = await page.query_selector(sel)
                if el:
                    price_text = (await el.inner_text()).strip()
                    break
            except Exception:
                pass
        price = _parse_price(price_text)

        images = []
        seen: set = set()
        img_els = await page.query_selector_all(".product-images img, .product__media img, [class*='gallery'] img")
        for img_el in img_els:
            src = (await img_el.get_attribute("src") or await img_el.get_attribute("data-src") or "").split("?")[0]
            if src and src not in seen and not src.endswith(".svg"):
                if src.startswith("//"):
                    src = "https:" + src
                seen.add(src)
                images.append({"url": src, "alt": await img_el.get_attribute("alt"), "local_path": None})

        handle     = url.rstrip("/").split("/products/")[-1].split("?")[0]
        product_id = handle

        return {
            "brand":            brand_slug,
            "product_id":       product_id,
            "name":             title,
            "handle":           handle,
            "url":              url,
            "description_html": desc,
            "price":            price,
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


class BSNScraper(BaseScraper):
    brand_slug   = "bsn"
    display_name = "BSN"
    base_url     = "https://www.bsnsupplements.com"

    async def scrape(self) -> List[Dict[str, Any]]:
        product_urls: List[str] = []
        products: List[Dict]    = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=BROWSER_HEADLESS)
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1440, "height": 900},
            )

            page          = await context.new_page()
            current_url: Optional[str] = _COLLECTIONS_URL

            while current_url:
                self.log.info("Catalog: %s", current_url)
                await page.goto(current_url, wait_until="domcontentloaded", timeout=BROWSER_TIMEOUT_MS)
                await asyncio.sleep(2)

                # try infinite scroll – scroll down
                for _ in range(5):
                    await page.keyboard.press("End")
                    await asyncio.sleep(1)

                links = await page.query_selector_all('a[href*="/products/"]')
                for link in links:
                    href = (await link.get_attribute("href") or "").split("?")[0]
                    if "/products/" in href and href not in product_urls:
                        if href.startswith("/"):
                            href = self.base_url + href
                        product_urls.append(href)

                self.log.info("  Total product URLs: %d", len(product_urls))

                next_el = await page.query_selector(
                    'a[rel="next"], .pagination__next, a[aria-label="Next page"]'
                )
                if next_el:
                    href = await next_el.get_attribute("href") or ""
                    current_url = (self.base_url + href) if href.startswith("/") else href or None
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                else:
                    current_url = None

            await page.close()

            self.log.info("Scraping %d BSN product pages …", len(product_urls))
            semaphore = asyncio.Semaphore(4)

            async def bounded(url: str) -> Optional[Dict]:
                async with semaphore:
                    res = await _scrape_bsn_product(context, url, self.brand_slug)
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                    return res

            results  = await asyncio.gather(*[bounded(u) for u in product_urls])
            products = [r for r in results if r]

            await browser.close()

        return products
