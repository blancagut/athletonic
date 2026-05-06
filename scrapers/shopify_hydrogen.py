"""Generic Shopify Hydrogen (headless) brand scraper.

Some Shopify storefronts (Liquid IV etc.) run on Hydrogen and expose products
as `/products/{handle}.json` with a different schema:
  - flat object (no `product:` wrapper)
  - `descriptionHtml`, `priceRange`, `media.nodes`, `variants.nodes`
Subclass: set brand_slug / display_name / base_url.
"""
import asyncio
import re
from typing import Any, Dict, List, Optional

import aiohttp

from config import DELAY_BETWEEN_PAGES, REQUEST_TIMEOUT
from scrapers.shopify_sitemap import SitemapShopifyScraper


class HydrogenShopifyScraper(SitemapShopifyScraper):
    """Sitemap-driven Hydrogen scraper."""

    sitemap_concurrency = 4

    async def _collect_handles(self, session: aiohttp.ClientSession) -> List[str]:
        # Try /sitemap_products.xml directly first (no _N suffix)
        for path in ("/sitemap_products.xml", "/sitemap.xml"):
            try:
                body = await self._fetch_text(session, f"{self.base_url.rstrip('/')}{path}")
            except Exception as exc:
                self.log.debug("%s failed: %s", path, exc)
                continue
            urls = re.findall(r"<loc>([^<]+/products/[^<]+)</loc>", body)
            if urls:
                handles, seen = [], set()
                for u in urls:
                    m = re.search(r"/products/([^/?#]+)", u)
                    if m and m.group(1) not in seen:
                        seen.add(m.group(1))
                        handles.append(m.group(1))
                return handles
            # if it's a sitemap index, recurse
            sm_idx = re.findall(r"<loc>([^<]+sitemap_products[^<]+\.xml[^<]*)</loc>", body)
            if sm_idx:
                handles, seen = [], set()
                for sm in sm_idx:
                    try:
                        b = await self._fetch_text(session, sm)
                        for u in re.findall(r"<loc>([^<]+/products/[^<]+)</loc>", b):
                            m = re.search(r"/products/([^/?#]+)", u)
                            if m and m.group(1) not in seen:
                                seen.add(m.group(1))
                                handles.append(m.group(1))
                    except Exception:
                        pass
                if handles:
                    return handles
        return []

    @staticmethod
    def _parse_hydrogen_product(d: Dict, brand_slug: str, base_url: str) -> Dict[str, Any]:
        handle = d.get("handle", "")
        url = f"{base_url.rstrip('/')}/products/{handle}"

        # Pricing
        pr = d.get("priceRange") or {}
        min_p = (pr.get("minVariantPrice") or {}).get("amount")
        max_p = (pr.get("maxVariantPrice") or {}).get("amount")
        currency = (pr.get("minVariantPrice") or {}).get("currencyCode") or "USD"
        try:
            price = float(min_p) if min_p is not None else None
        except (TypeError, ValueError):
            price = None
        compare = None  # Hydrogen schema doesn't surface compareAtPrice on root

        # Variants (variants.nodes[*])
        variants_raw = (d.get("variants") or {}).get("nodes") or []
        variants: List[Dict] = []
        prices: List[float] = []
        compares: List[float] = []
        for v in variants_raw:
            p = (v.get("price") or {}).get("amount")
            cap = (v.get("compareAtPrice") or {}).get("amount") if isinstance(v.get("compareAtPrice"), dict) else None
            try:
                p_f = float(p) if p is not None else None
            except (TypeError, ValueError):
                p_f = None
            try:
                cap_f = float(cap) if cap not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                cap_f = None
            if p_f is not None:
                prices.append(p_f)
            if cap_f is not None:
                compares.append(cap_f)
            # selectedOptions or option1/2/3 from title split
            opt1 = opt2 = opt3 = None
            sel = v.get("selectedOptions") or []
            if sel:
                opt1 = sel[0].get("value") if len(sel) > 0 else None
                opt2 = sel[1].get("value") if len(sel) > 1 else None
                opt3 = sel[2].get("value") if len(sel) > 2 else None
            else:
                title_parts = (v.get("title") or "").split(" / ")
                opt1 = title_parts[0] if len(title_parts) > 0 else None
                opt2 = title_parts[1] if len(title_parts) > 1 else None
                opt3 = title_parts[2] if len(title_parts) > 2 else None
            grams = None
            w = v.get("weight")
            wu = (v.get("weightUnit") or "").upper()
            if w is not None:
                try:
                    w = float(w)
                    if wu == "POUNDS":
                        grams = w * 453.592
                    elif wu == "OUNCES":
                        grams = w * 28.3495
                    elif wu == "KILOGRAMS":
                        grams = w * 1000
                    elif wu == "GRAMS":
                        grams = w
                except (TypeError, ValueError):
                    grams = None
            variants.append({
                "variant_id": str(v.get("id", "")),
                "title": v.get("title"),
                "sku": v.get("sku"),
                "option1": opt1,
                "option2": opt2,
                "option3": opt3,
                "price": p_f,
                "compare_at_price": cap_f,
                "available": v.get("availableForSale", True),
                "weight_grams": grams,
            })

        if prices and price is None:
            price = min(prices)
        if compares:
            compare = min(compares)

        # Images: combine featuredImage and media.nodes
        seen_urls = set()
        images: List[Dict] = []
        feat = d.get("featuredImage") or {}
        if feat.get("url"):
            u = feat["url"].split("?")[0]
            seen_urls.add(u)
            images.append({
                "url": u,
                "alt": feat.get("altText"),
                "position": 0,
                "width": feat.get("width"),
                "height": feat.get("height"),
                "local_path": None,
            })
        for idx, m in enumerate((d.get("media") or {}).get("nodes") or [], start=1):
            pi = m.get("previewImage") or {}
            uu = pi.get("url")
            if not uu:
                continue
            uu_clean = uu.split("?")[0]
            if uu_clean in seen_urls:
                continue
            seen_urls.add(uu_clean)
            images.append({
                "url": uu_clean,
                "alt": pi.get("altText") or m.get("alt"),
                "position": idx,
                "width": pi.get("width"),
                "height": pi.get("height"),
                "local_path": None,
            })

        options = [
            {"name": opt.get("name"), "values": opt.get("values", [])}
            for opt in (d.get("options") or [])
        ]

        sku = next((v.get("sku") for v in variants_raw if v.get("sku")), None)
        tags = d.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        return {
            "brand": brand_slug,
            "product_id": str(d.get("id", "")),
            "vendor": d.get("vendor", ""),
            "sku": sku,
            "name": d.get("title", ""),
            "handle": handle,
            "url": url,
            "description_html": d.get("descriptionHtml") or d.get("description", "") or "",
            "category": d.get("productType", ""),
            "tags": tags,
            "price": price,
            "compare_at_price": compare,
            "currency": currency,
            "available": any(v.get("availableForSale", True) for v in variants_raw) if variants_raw else True,
            "variants": variants,
            "images": images,
            "options": options,
        }

    async def _fetch_product(
        self, session: aiohttp.ClientSession, handle: str, sem: asyncio.Semaphore
    ) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url.rstrip('/')}/products/{handle}.json"
        async with sem:
            try:
                data, _ = await self._get_json(session, url)
            except Exception as exc:
                self.log.warning("product %s failed: %s", handle, exc)
                return None
            if not data:
                return None
            await asyncio.sleep(DELAY_BETWEEN_PAGES / 2)
            # Detect schema: standard (`product` wrapper) vs Hydrogen (flat)
            if isinstance(data, dict) and "product" in data:
                return self._parse_product(data["product"], self.brand_slug, self.base_url)
            return self._parse_hydrogen_product(data, self.brand_slug, self.base_url)
