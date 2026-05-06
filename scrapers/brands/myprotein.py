"""
MyProtein scraper – Playwright.
MyProtein uses a custom platform (THG / The Hut Group).
Scrapes the full product catalogue from /sports-nutrition/all-products.list
with infinite scroll / load-more pagination.
"""
import asyncio
import json
import re
from typing import Any, Dict, List, Optional

from playwright.async_api import async_playwright, BrowserContext, Page

from config import BROWSER_HEADLESS, BROWSER_TIMEOUT_MS, DELAY_BETWEEN_PAGES, USER_AGENT
from scrapers.base import BaseScraper

_CATALOG_URL = "https://www.myprotein.com/sports-nutrition/all-products.list"


def _parse_price(text: str) -> Optional[float]:
    match = re.search(r"[\d,]+\.?\d*", text.replace(",", ""))
    return float(match.group()) if match else None


async def _scrape_myprotein_product(context: BrowserContext, url: str, brand_slug: str) -> Optional[Dict]:
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=BROWSER_TIMEOUT_MS)
        await asyncio.sleep(2)

        # JSON-LD
        jsonld: Optional[Dict] = None
        try:
            scripts = await page.query_selector_all('script[type="application/ld+json"]')
            for s in scripts:
                data  = json.loads(await s.inner_text())
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if item.get("@type") in ("Product", "product"):
                        jsonld = item
                        break
        except Exception:
            pass

        title = ""
        for sel in ("h1.productName_title", "h1[class*='productName']", "h1", ".product-name"):
            try:
                el = await page.query_selector(sel)
                if el:
                    title = (await el.inner_text()).strip()
                    break
            except Exception:
                pass

        desc_el = await page.query_selector(
            ".productDescription_content, [class*='productDescription'], "
            ".product-description, [class*='description']"
        )
        desc = (await desc_el.inner_html()).strip() if desc_el else ""

        price_text = ""
        for sel in (".productPrice_price", "[class*='productPrice']", ".product-price", "[class*='price']"):
            try:
                el = await page.query_selector(sel)
                if el:
                    price_text = (await el.inner_text()).strip()
                    break
            except Exception:
                pass
        price = _parse_price(price_text)
        if not price and jsonld:
            try:
                offers = jsonld.get("offers", {})
                if isinstance(offers, list):
                    offers = offers[0]
                price = float(offers.get("price", 0)) or None
            except Exception:
                pass

        # images
        images = []
        seen: set = set()
        img_els = await page.query_selector_all(
            ".productImageCarousel img, .product-images img, "
            "[class*='productImage'] img, .athenaProductImageCarousel img"
        )
        for img_el in img_els:
            src = (
                await img_el.get_attribute("src")
                or await img_el.get_attribute("data-src")
                or await img_el.get_attribute("data-lazy")
                or ""
            )
            src = src.split("?")[0]
            if src and src not in seen and not src.endswith(".svg"):
                if src.startswith("//"):
                    src = "https:" + src
                seen.add(src)
                images.append({"url": src, "alt": await img_el.get_attribute("alt"), "local_path": None})

        # variants (flavours/sizes – THG uses a selector)
        variants = []
        var_groups = await page.query_selector_all("[class*='variations'] [class*='option'], .productVariations li, [class*='variantSelector'] li")
        for var_el in var_groups:
            val = (await var_el.get_attribute("data-option-id") or "").strip()
            txt = (await var_el.inner_text()).strip()
            if txt:
                variants.append({"variant_id": val or txt, "title": txt, "price": price, "available": True})

        # tags
        tags = []
        for sel in ("[class*='category']", ".breadcrumb a", "nav[aria-label*='read'] a"):
            try:
                els = await page.query_selector_all(sel)
                for el in els:
                    txt = (await el.inner_text()).strip()
                    if txt:
                        tags.append(txt)
            except Exception:
                pass

        handle     = url.rstrip("/").split("/")[-1].split("?")[0].replace(".html", "")
        product_id = (jsonld or {}).get("sku") or handle

        return {
            "brand":            brand_slug,
            "product_id":       product_id,
            "name":             title or (jsonld.get("name") if jsonld else ""),
            "handle":           handle,
            "url":              url,
            "description_html": desc,
            "price":            price,
            "currency":         "GBP",   # MyProtein primary currency is GBP
            "images":           images,
            "variants":         variants,
            "tags":             list(set(tags)),
            "options":          [],
        }
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Error scraping %s: %s", url, exc)
        return None
    finally:
        await page.close()


class MyProteinScraper(BaseScraper):
    brand_slug   = "myprotein"
    display_name = "MyProtein"
    base_url     = "https://www.myprotein.com"

    async def _collect_product_urls(self, context: BrowserContext) -> List[str]:
        """Scroll through the all-products listing and collect every product URL."""
        product_urls: List[str] = []
        page = await context.new_page()

        await page.goto(_CATALOG_URL, wait_until="domcontentloaded", timeout=BROWSER_TIMEOUT_MS)
        await asyncio.sleep(3)

        # Accept cookies if modal appears
        for sel in ("[id*='accept'], [class*='accept'], button:has-text('Accept All')"):
            try:
                btn = await page.query_selector(sel)
                if btn:
                    await btn.click()
                    await asyncio.sleep(1)
                    break
            except Exception:
                pass

        MAX_SCROLLS = 200
        prev_count  = 0

        for i in range(MAX_SCROLLS):
            # scroll to bottom to trigger load-more / infinite scroll
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1.5)

            # click any "Load More" button
            try:
                load_more = await page.query_selector(
                    "button:has-text('Load More'), button:has-text('Show More'), "
                    "[class*='loadMore'], [class*='load-more']"
                )
                if load_more:
                    await load_more.click()
                    await asyncio.sleep(2)
            except Exception:
                pass

            links = await page.query_selector_all(
                "a.athenaProductBlock_link, a[href*='/sports-nutrition/'], "
                "a[class*='productBlock'], .product-grid a"
            )
            for link in links:
                href = (await link.get_attribute("href") or "").split("?")[0]
                if href and href not in product_urls:
                    if href.startswith("/"):
                        href = self.base_url + href
                    if ".html" in href or "/sports-nutrition/" in href:
                        product_urls.append(href)

            current_count = len(product_urls)
            if current_count == prev_count and i > 5:
                # no new products found after 5 attempts – we're done
                break
            prev_count = current_count
            self.log.info("  MyProtein scroll %d – URLs collected: %d", i + 1, current_count)

        await page.close()
        return product_urls

    async def scrape(self) -> List[Dict[str, Any]]:
        products: List[Dict] = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=BROWSER_HEADLESS)
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1440, "height": 900},
                locale="en-GB",
            )

            product_urls = await self._collect_product_urls(context)
            self.log.info("MyProtein – %d product URLs to scrape", len(product_urls))

            semaphore = asyncio.Semaphore(3)

            async def bounded(url: str) -> Optional[Dict]:
                async with semaphore:
                    res = await _scrape_myprotein_product(context, url, self.brand_slug)
                    await asyncio.sleep(DELAY_BETWEEN_PAGES)
                    return res

            results  = await asyncio.gather(*[bounded(u) for u in product_urls])
            products = [r for r in results if r]

            await browser.close()

        return products
