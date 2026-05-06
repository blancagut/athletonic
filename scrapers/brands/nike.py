import asyncio
import ssl
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urljoin

import aiohttp
import certifi
from aiohttp import ClientResponseError
from tenacity import retry, stop_after_attempt, wait_random_exponential

from config import DELAY_BETWEEN_PAGES, REQUEST_TIMEOUT, USER_AGENT
from scrapers.base import BaseScraper


class NikeScraper(BaseScraper):
    brand_slug = "nike"
    display_name = "Nike"
    base_url = "https://www.nike.com"

    api_base_url = "https://api.nike.com/product_feed/threads/v2/"
    page_size = 100

    def __init__(self) -> None:
        super().__init__()
        self._ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        self._headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Origin": self.base_url,
            "Referer": f"{self.base_url}/",
        }

    def _feed_url(self, anchor: Optional[int] = None) -> str:
        params: list[tuple[str, str]] = [
            ("filter", "marketplace(US)"),
            ("filter", "language(en)"),
            ("filter", "channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)"),
            ("filter", "productInfo.merchProduct.status(ACTIVE)"),
            ("count", str(self.page_size)),
        ]
        if anchor is not None:
            params.append(("anchor", str(anchor)))
        return f"{self.api_base_url}?{urlencode(params)}"

    @retry(stop=stop_after_attempt(5), wait=wait_random_exponential(min=5, max=45), reraise=True)
    async def _get_json(self, session: aiohttp.ClientSession, url: str) -> Dict[str, Any]:
        timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
        async with session.get(url, headers=self._headers, timeout=timeout, ssl=self._ssl_ctx) as resp:
            if resp.status == 429:
                retry_after = int(resp.headers.get("Retry-After", "30"))
                self.log.warning("Nike rate limited (429), waiting %ds", retry_after)
                await asyncio.sleep(retry_after)
                resp.raise_for_status()
            resp.raise_for_status()
            return await resp.json(content_type=None)

    @staticmethod
    def _first_product_info(raw: Dict[str, Any]) -> Dict[str, Any]:
        product_info = raw.get("productInfo") or []
        return product_info[0] if product_info else {}

    @staticmethod
    def _collect_images(node: Any) -> List[Dict[str, Any]]:
        images: List[Dict[str, Any]] = []

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                props = value.get("properties") or {}
                image_url = props.get("squarishURL") or props.get("portraitURL") or props.get("landscapeURL")
                if image_url:
                    images.append(
                        {
                            "url": image_url.split("?")[0],
                            "alt": props.get("altText"),
                            "position": len(images),
                            "width": None,
                            "height": None,
                            "local_path": None,
                        }
                    )
                for child in value.get("nodes") or []:
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(node)
        seen = set()
        unique_images = []
        for image in images:
            if image["url"] in seen:
                continue
            seen.add(image["url"])
            image["position"] = len(unique_images)
            unique_images.append(image)
        return unique_images

    def _parse_product(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        info = self._first_product_info(raw)
        merch_product = info.get("merchProduct") or {}
        if not merch_product:
            return None

        published = raw.get("publishedContent") or {}
        props = published.get("properties") or {}
        price = info.get("merchPrice") or {}
        style_color = merch_product.get("styleColor") or merch_product.get("id") or raw.get("id")
        if not style_color:
            return None

        title = props.get("title") or merch_product.get("labelName") or style_color
        subtitle = props.get("subtitle") or merch_product.get("productType") or ""
        slug = (props.get("seo") or {}).get("slug")
        url = f"{self.base_url}/t/{slug}" if slug else self.base_url

        available_skus = {
            item.get("skuId") or item.get("id"): bool(item.get("available"))
            for item in info.get("availableSkus") or []
        }
        variants = []
        for sku in info.get("skus") or []:
            variant_id = sku.get("id") or sku.get("stockKeepingUnitId")
            if not variant_id:
                continue
            variants.append(
                {
                    "variant_id": str(variant_id),
                    "title": sku.get("nikeSize") or sku.get("localizedSize"),
                    "sku": sku.get("stockKeepingUnitId") or sku.get("gtin"),
                    "option1": sku.get("nikeSize"),
                    "option2": None,
                    "option3": None,
                    "price": price.get("currentPrice"),
                    "compare_at_price": price.get("fullPrice") if price.get("fullPrice") != price.get("currentPrice") else None,
                    "available": available_skus.get(variant_id, False),
                    "weight_grams": None,
                }
            )

        tags = []
        for value in merch_product.get("genders") or []:
            tags.append(str(value).title())
        for value in merch_product.get("sportTags") or []:
            tags.append(str(value))
        if merch_product.get("productType"):
            tags.append(str(merch_product["productType"]).title())
        if merch_product.get("brand"):
            tags.append(str(merch_product["brand"]))

        return {
            "brand": self.brand_slug,
            "product_id": str(style_color),
            "vendor": merch_product.get("brand") or "Nike",
            "sku": merch_product.get("styleCode") or merch_product.get("pid"),
            "name": title,
            "handle": slug,
            "url": url,
            "description_html": subtitle,
            "category": merch_product.get("productType") or subtitle,
            "tags": tags,
            "price": price.get("currentPrice"),
            "compare_at_price": price.get("fullPrice") if price.get("fullPrice") != price.get("currentPrice") else None,
            "currency": price.get("currency") or "USD",
            "available": any(variant.get("available") for variant in variants) if variants else True,
            "variants": variants,
            "images": self._collect_images(published),
            "options": [{"name": "Size", "values": [variant["option1"] for variant in variants if variant.get("option1")]}],
        }

    async def scrape(self) -> List[Dict[str, Any]]:
        products: List[Dict[str, Any]] = []
        seen = set()
        anchor: Optional[int] = None
        page = 1

        async with aiohttp.ClientSession() as session:
            while True:
                try:
                    data = await self._get_json(session, self._feed_url(anchor))
                except ClientResponseError as exc:
                    if exc.status == 400 and products:
                        self.log.warning("Nike feed stopped at anchor %s with HTTP 400; keeping %d products", anchor, len(products))
                        break
                    raise
                raw_products = data.get("objects") or []
                if not raw_products:
                    break

                for raw in raw_products:
                    product = self._parse_product(raw)
                    if not product or product["product_id"] in seen:
                        continue
                    seen.add(product["product_id"])
                    products.append(product)

                pages = data.get("pages") or {}
                self.log.info(
                    "%s – page %d → %d products (total: %d / feed: %s)",
                    self.display_name,
                    page,
                    len(raw_products),
                    len(products),
                    pages.get("totalResources"),
                )

                next_path = pages.get("next")
                if not next_path:
                    break
                anchor = self.page_size if anchor is None else anchor + self.page_size
                page += 1
                await asyncio.sleep(DELAY_BETWEEN_PAGES)

        self.log.info("%s – total %d products scraped", self.display_name, len(products))
        return products