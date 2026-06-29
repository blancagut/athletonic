#!/usr/bin/env python3
"""Crawl Boon and Top King official catalogs and emit a merged JSON array."""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import math
import re
import sys
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 45
RETRY_ATTEMPTS = 4
TOPKING_PAGE_SIZE = 32
TOPKING_REQUEST_DELAY = 0.35

BOON_BASE = "https://www.boonsport.com"
TOPKING_BASE = "https://www.topkingboxing.com"
TOPKING_MIRROR = "https://r.jina.ai/http://"

_thread_local = threading.local()
_topking_fetch_lock = threading.Lock()


def get_session() -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})
        _thread_local.session = session
    return session


def fetch_text(url: str, *, timeout: int = REQUEST_TIMEOUT) -> str:
    last_exc: Exception | None = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = get_session().get(url, timeout=timeout)
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                sleep_for = 8.0
                if retry_after:
                    try:
                        sleep_for = max(sleep_for, float(retry_after))
                    except ValueError:
                        pass
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(sleep_for)
                    continue
                resp.raise_for_status()
            resp.raise_for_status()
            if not resp.encoding:
                resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < RETRY_ATTEMPTS:
                time.sleep(min(8.0, 1.5 ** attempt))
    raise RuntimeError(f"Failed to fetch {url}: {last_exc}") from last_exc


def fetch_json(url: str, *, timeout: int = REQUEST_TIMEOUT) -> Any:
    last_exc: Exception | None = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = get_session().get(url, timeout=timeout)
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                sleep_for = 8.0
                if retry_after:
                    try:
                        sleep_for = max(sleep_for, float(retry_after))
                    except ValueError:
                        pass
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(sleep_for)
                    continue
                resp.raise_for_status()
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < RETRY_ATTEMPTS:
                time.sleep(min(8.0, 1.5 ** attempt))
    raise RuntimeError(f"Failed to fetch JSON {url}: {last_exc}") from last_exc


def jina_url(url: str) -> str:
    if url.startswith("https://"):
        return TOPKING_MIRROR + url[len("https://") :]
    if url.startswith("http://"):
        return TOPKING_MIRROR + url[len("http://") :]
    return TOPKING_MIRROR + url


def normalize_space(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", value).strip()
    return text or None


def compact_html(html_text: Optional[str]) -> Optional[str]:
    if not html_text:
        return None
    text = html_text.strip()
    return text or None


def merge_unique(existing: List[str], new_values: Iterable[str]) -> List[str]:
    seen = set(existing)
    for value in new_values:
        if value is None:
            continue
        item = normalize_space(str(value))
        if not item or item in seen:
            continue
        seen.add(item)
        existing.append(item)
    return existing


def join_categories(categories: Sequence[str]) -> Optional[str]:
    items: List[str] = []
    seen: set[str] = set()
    for raw in categories:
        item = normalize_space(raw)
        if not item or item in seen:
            continue
        seen.add(item)
        items.append(item)
    if not items:
        return None
    return " | ".join(items)


def parse_number(value: str) -> Optional[float | int]:
    value = value.replace(",", "").strip()
    if not value:
        return None
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return None


def first_nonempty(lines: Iterable[str], *, skip: set[str] | None = None) -> Optional[str]:
    skip = skip or set()
    for line in lines:
        item = normalize_space(line)
        if not item or item in skip:
            continue
        return item
    return None


COLOR_PATTERNS = [
    "LIGHT BLUE",
    "DARK BLUE",
    "ROYAL BLUE",
    "SKY BLUE",
    "NAVY BLUE",
    "LIGHT GREEN",
    "DARK GREEN",
    "GREEN",
    "BLACK",
    "WHITE",
    "RED",
    "PINK",
    "PURPLE",
    "ORANGE",
    "YELLOW",
    "GREY",
    "GRAY",
    "BROWN",
    "BEIGE",
    "GOLD",
    "SILVER",
    "BLUE",
    "LIME",
    "OLIVE",
    "BURGUNDY",
    "MAROON",
    "MULTI",
    "CAMO",
    "CAMOUFLAGE",
    "THAI FLAG",
]

COLOR_CODE_MAP = {
    "BK": "BLACK",
    "BL": "BLUE",
    "BU": "BLUE",
    "RD": "RED",
    "RE": "RED",
    "WH": "WHITE",
    "WT": "WHITE",
    "GY": "GREY",
    "GR": "GREEN",
    "GN": "GREEN",
    "GN1": "GREEN",
    "PP": "PURPLE",
    "PK": "PINK",
    "PN": "PINK",
    "OR": "ORANGE",
    "YL": "YELLOW",
    "YW": "YELLOW",
    "LB": "LIGHT BLUE",
    "SB": "SKY BLUE",
    "NV": "NAVY BLUE",
    "BR": "BROWN",
    "BE": "BEIGE",
    "GD": "GOLD",
    "SL": "SILVER",
}

SIZE_PATTERNS = [
    "4OZ",
    "6OZ",
    "8OZ",
    "10OZ",
    "12OZ",
    "14OZ",
    "16OZ",
    "18OZ",
    "20OZ",
    "XXXS",
    "XXS",
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "XXXL",
]

MATERIAL_PATTERNS = [
    "genuine leather",
    "leather",
    "genuine cowhide",
    "cowhide",
    "nylon",
    "satin",
    "polyester",
    "cotton",
    "mesh",
    "canvas",
    "microfiber",
    "foam",
]

STANDARD_GLOVE_SIZES = ["8oz", "10oz", "12oz", "14oz"]
STANDARD_PROTECTION_SIZES = ["S", "M", "L", "XL"]


def detect_tokens(text: str, patterns: Sequence[str]) -> List[str]:
    upper = text.upper()
    found: List[str] = []
    for pattern in patterns:
        if re.search(rf"\b{re.escape(pattern)}\b", upper, re.I) and pattern.upper() not in {
            x.upper() for x in found
        }:
            found.append(pattern)
    return found


def detect_topking_color_codes(sku: Optional[str]) -> List[str]:
    if not sku:
        return []
    tokens = re.split(r"[-_/ ]+", sku.upper())
    found: List[str] = []
    for token in tokens:
        if token in COLOR_CODE_MAP:
            color = COLOR_CODE_MAP[token]
            if color not in found:
                found.append(color)
    return found


def normalize_topking_category_path(items: Sequence[str]) -> Optional[str]:
    cleaned = [normalize_space(item) for item in items if normalize_space(item)]
    if not cleaned:
        return None
    if cleaned and cleaned[0].lower() == "home":
        cleaned = cleaned[1:]
    if cleaned and cleaned[0].lower() == "all products":
        cleaned = cleaned[1:]
    if not cleaned:
        return None
    return " > ".join(cleaned)


@dataclass
class ProductAccumulator:
    brand: str
    product_key: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    product_url: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    price: Optional[float | int] = None
    currency: Optional[str] = None
    available_sizes: List[str] = field(default_factory=list)
    available_colors: List[str] = field(default_factory=list)
    available_variants: List[str] = field(default_factory=list)
    material: Optional[str] = None
    weight: Optional[float | int] = None
    country_of_origin: Optional[str] = None
    stock_status: Optional[str] = None
    images: List[str] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)

    def merge_categories(self, values: Iterable[str]) -> None:
        self.categories = merge_unique(self.categories, values)

    def merge_images(self, values: Iterable[str]) -> None:
        self.images = merge_unique(self.images, values)

    def merge_sizes(self, values: Iterable[str]) -> None:
        self.available_sizes = merge_unique(self.available_sizes, values)

    def merge_colors(self, values: Iterable[str]) -> None:
        self.available_colors = merge_unique(self.available_colors, values)

    def merge_variants(self, values: Iterable[str]) -> None:
        self.available_variants = merge_unique(self.available_variants, values)

    def finalize(self) -> Dict[str, Any]:
        return {
            "brand": self.brand,
            "category": join_categories(self.categories),
            "product_name": self.product_name,
            "sku": self.sku,
            "product_url": self.product_url,
            "short_description": self.short_description,
            "full_description": self.full_description,
            "price": self.price,
            "currency": self.currency,
            "available_sizes": self.available_sizes,
            "available_colors": self.available_colors,
            "available_variants": self.available_variants,
            "material": self.material,
            "weight": self.weight,
            "country_of_origin": self.country_of_origin,
            "stock_status": self.stock_status,
            "images": self.images,
        }


def product_id_from_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    parts = path.split("/")
    if len(parts) < 2:
        return path
    if parts[0] == "product" and len(parts) >= 2:
        return parts[1]
    if parts[0] == "th" and len(parts) >= 3 and parts[1] == "product":
        return parts[2]
    return parts[-1]


def canonical_topking_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path
    if path.startswith("/th/"):
        path = path[len("/th") :]
    return f"{TOPKING_BASE}{path}"


def parse_boon_sitemap() -> Tuple[List[str], List[str]]:
    xml_text = fetch_text(f"{BOON_BASE}/sitemap.xml")
    sitemap_urls = re.findall(r"<loc>([^<]+)</loc>", xml_text)
    product_urls: List[str] = []
    collection_urls: List[str] = []
    for sitemap_url in sitemap_urls:
        if "sitemap_products" in sitemap_url:
            product_xml = fetch_text(sitemap_url)
            product_urls.extend(re.findall(r"<loc>([^<]+/products/[^<]+)</loc>", product_xml))
        elif "sitemap_collections" in sitemap_url:
            collection_xml = fetch_text(sitemap_url)
            collection_urls.extend(re.findall(r"<loc>([^<]+/collections/[^<]+)</loc>", collection_xml))
    product_urls = [u for u in dict.fromkeys(product_urls) if "/products/" in urlparse(u).path]
    collection_urls = [u for u in dict.fromkeys(collection_urls) if "/collections/" in urlparse(u).path]
    return product_urls, collection_urls


def extract_boon_collection_title(soup: BeautifulSoup) -> Optional[str]:
    h1 = soup.find("h1")
    title = normalize_space(h1.get_text(" ", strip=True)) if h1 else None
    if not title:
        return None
    title = re.sub(r"(?i)^official boon® sport\s*", "", title).strip()
    title = re.sub(r"(?i)^boon sport\s*", "", title).strip()
    return title or None


def parse_boon_collection_page(url: str) -> Tuple[str, List[str], Optional[str]]:
    html_text = fetch_text(url)
    soup = BeautifulSoup(html_text, "lxml")
    title = extract_boon_collection_title(soup) or urlparse(url).path.rsplit("/", 1)[-1]
    product_urls: List[str] = []
    for holder in soup.select("div.card--holder"):
        a = holder.find("a", href=lambda href: bool(href and href.startswith("/products/")))
        if not a:
            continue
        href = a.get("href")
        if href:
            product_urls.append(urljoin(BOON_BASE, href))
    product_urls = list(dict.fromkeys(product_urls))
    next_link = soup.find("link", rel="next")
    next_url = urljoin(url, next_link.get("href")) if next_link and next_link.get("href") else None
    return title, product_urls, next_url


def parse_boon_collection_pages(collection_urls: Sequence[str]) -> Dict[str, List[str]]:
    def crawl_branch(start_url: str) -> Tuple[str, List[str]]:
        title, product_urls, next_url = parse_boon_collection_page(start_url)
        visited_pages = {start_url}
        while next_url and next_url not in visited_pages:
            visited_pages.add(next_url)
            try:
                _, more_products, next_url = parse_boon_collection_page(next_url)
            except Exception as exc:  # noqa: BLE001
                print(f"[boon] collection page failed: {next_url} ({exc})", file=sys.stderr, flush=True)
                break
            product_urls = merge_unique(product_urls, more_products)
        return title, product_urls

    category_map: Dict[str, List[str]] = defaultdict(list)
    with cf.ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {executor.submit(crawl_branch, url): url for url in collection_urls}
        for idx, future in enumerate(cf.as_completed(future_map), start=1):
            url = future_map[future]
            try:
                title, product_urls = future.result()
            except Exception as exc:  # noqa: BLE001
                print(f"[boon] collection page failed: {url} ({exc})", file=sys.stderr, flush=True)
                continue
            category_map[title] = merge_unique(category_map[title], product_urls)
            if idx % 20 == 0:
                print(f"[boon] collections done: {idx}/{len(collection_urls)}", file=sys.stderr, flush=True)
    return category_map


def parse_boon_product_json(raw: Dict[str, Any], product_url: str) -> Dict[str, Any]:
    variants_raw = raw.get("variants", []) or []
    options_raw = raw.get("options", []) or []
    tags_raw = raw.get("tags", []) or []
    if isinstance(tags_raw, str):
        tags = [tag.strip() for tag in tags_raw.split(",") if tag.strip()]
    else:
        tags = [str(tag).strip() for tag in tags_raw if str(tag).strip()]

    title = raw.get("title")
    description = raw.get("body_html") or raw.get("description")
    currency = "THB"

    prices: List[float | int] = []
    for variant in variants_raw:
        price = variant.get("price")
        if price in (None, "", 0, "0", "0.00", 0.0):
            continue
        parsed = parse_number(str(price))
        if parsed is not None:
            prices.append(parsed)
    price = min(prices) if prices else parse_number(str(raw.get("price"))) or None

    available = any(bool(v.get("available", True)) for v in variants_raw) if variants_raw else bool(raw.get("available"))
    stock_status = "in stock" if available else "out of stock"

    sku_values = [normalize_space(str(v.get("sku"))) for v in variants_raw if normalize_space(str(v.get("sku")))]
    sku = sku_values[0] if len(set(sku_values)) == 1 else (sku_values[0] if sku_values else None)

    variant_titles = [normalize_space(str(v.get("title"))) for v in variants_raw if normalize_space(str(v.get("title")))]
    if variant_titles == ["Default Title"]:
        variant_titles = []

    size_values: List[str] = []
    color_values: List[str] = []
    for opt in options_raw:
        name = normalize_space(str(opt.get("name") or ""))
        values = [normalize_space(str(v)) for v in (opt.get("values") or []) if normalize_space(str(v))]
        name_l = name.lower()
        if any(k in name_l for k in ["size", "oz", "weight", "measure"]):
            size_values.extend(values)
        elif "color" in name_l or "colour" in name_l:
            color_values.extend(values)
        else:
            for value in values:
                if re.search(r"\b(?:\d+oz|xs|s|m|l|xl|xxl|xxxl)\b", value, re.I):
                    size_values.append(value)
                elif re.search(
                    r"\b(?:black|white|red|blue|green|yellow|orange|purple|pink|grey|gray|brown|beige|gold|silver|burgundy|navy|olive|multi|camo|camouflage|thai flag)\b",
                    value,
                    re.I,
                ):
                    color_values.append(value)

    merged_tokens = " ".join([title or "", description or "", " ".join(tags)])
    if not size_values:
        size_values = detect_tokens(title or merged_tokens, SIZE_PATTERNS)
    if not color_values:
        color_values = detect_tokens(title or merged_tokens, COLOR_PATTERNS)

    materials = detect_tokens(merged_tokens, MATERIAL_PATTERNS)
    material = materials[0] if materials else None
    country_of_origin = "Thailand" if re.search(r"hand-?made in thailand|made in thailand|\bthailand\b", merged_tokens, re.I) else None

    weights = [variant.get("grams") for variant in variants_raw if variant.get("grams") not in (None, "", 0, "0")]
    weight = None
    if weights:
        parsed_weights = [parse_number(str(w)) for w in weights]
        parsed_weights = [w for w in parsed_weights if w is not None]
        if parsed_weights:
            weight = parsed_weights[0]

    images: List[str] = []
    for img in raw.get("images", []) or []:
        if not img:
            continue
        if isinstance(img, dict):
            src = img.get("src") or img.get("url")
        else:
            src = img
        if not src:
            continue
        src = str(src)
        images.append(src if src.startswith("http") else f"https:{src}")
    images = list(dict.fromkeys(images))

    return {
        "product_name": title,
        "sku": sku,
        "product_url": product_url,
        "full_description": compact_html(description),
        "price": price,
        "currency": currency,
        "available_sizes": size_values,
        "available_colors": color_values,
        "available_variants": variant_titles or merge_unique([], size_values + color_values),
        "material": material,
        "weight": weight,
        "country_of_origin": country_of_origin,
        "stock_status": stock_status,
        "images": images,
        "short_description": None,
    }


def fetch_boon_products_bulk() -> List[Dict[str, Any]]:
    products: List[Dict[str, Any]] = []
    page = 1
    while True:
        data = fetch_json(f"{BOON_BASE}/products.json?limit=250&page={page}")
        batch = data.get("products", []) or []
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 250:
            break
        page += 1
    return products


def build_boon_catalog() -> Dict[str, ProductAccumulator]:
    product_urls, collection_urls = parse_boon_sitemap()
    print(f"[boon] sitemap: {len(collection_urls)} collections, {len(product_urls)} products", file=sys.stderr, flush=True)
    collection_map = parse_boon_collection_pages(collection_urls)
    print(f"[boon] collections with products: {len(collection_map)}", file=sys.stderr, flush=True)

    product_map: Dict[str, ProductAccumulator] = {}
    for category, urls in collection_map.items():
        for url in urls:
            key = urlparse(url).path.rsplit("/", 1)[-1]
            acc = product_map.get(key)
            if acc is None:
                acc = ProductAccumulator(brand="Boon", product_key=key)
                product_map[key] = acc
            acc.product_url = acc.product_url or url
            acc.merge_categories([category])

    bulk_products = fetch_boon_products_bulk()
    print(f"[boon] bulk products fetched: {len(bulk_products)}", file=sys.stderr, flush=True)
    for idx, raw in enumerate(bulk_products, start=1):
        handle = normalize_space(str(raw.get("handle")))
        if not handle:
            continue
        product_url = f"{BOON_BASE}/products/{handle}"
        parsed = parse_boon_product_json(raw, product_url)
        acc = product_map.get(handle)
        if acc is None:
            acc = ProductAccumulator(brand="Boon", product_key=handle)
            product_map[handle] = acc
        acc.product_url = acc.product_url or parsed.get("product_url")
        acc.product_name = acc.product_name or parsed.get("product_name")
        acc.sku = acc.sku or parsed.get("sku")
        acc.full_description = acc.full_description or parsed.get("full_description")
        acc.price = acc.price if acc.price not in (None, 0, 0.0) else parsed.get("price")
        acc.currency = acc.currency or parsed.get("currency")
        acc.merge_sizes(parsed.get("available_sizes") or [])
        acc.merge_colors(parsed.get("available_colors") or [])
        acc.merge_variants(parsed.get("available_variants") or [])
        acc.material = acc.material or parsed.get("material")
        acc.weight = acc.weight or parsed.get("weight")
        acc.country_of_origin = acc.country_of_origin or parsed.get("country_of_origin")
        acc.stock_status = acc.stock_status or parsed.get("stock_status")
        acc.merge_images(parsed.get("images") or [])
        if idx % 50 == 0:
            print(f"[boon] bulk products done: {idx}/{len(bulk_products)}", file=sys.stderr, flush=True)

    for acc in product_map.values():
        merged_text = " ".join([acc.product_name or "", acc.full_description or "", acc.short_description or ""]).lower()
        if acc.material is None:
            for token in MATERIAL_PATTERNS:
                if token in merged_text:
                    acc.material = token
                    break
        if acc.country_of_origin is None and re.search(r"hand-?made in thailand|made in thailand|\bthailand\b", merged_text, re.I):
            acc.country_of_origin = "Thailand"

    return product_map


def parse_topking_sitemap() -> Tuple[List[str], List[str]]:
    text = fetch_text(jina_url(f"{TOPKING_BASE}/sitemap.xml"))
    urls = re.findall(r"\[(https?://[^\]]+)\]\(", text)
    product_urls: List[str] = []
    category_urls: List[str] = []
    for url in urls:
        path = urlparse(url).path
        if "/th/" in path:
            continue
        if path.startswith("/product/"):
            product_urls.append(url)
        elif path.startswith("/category/"):
            category_urls.append(url)
    product_urls = list(dict.fromkeys(product_urls))
    category_urls = list(dict.fromkeys(category_urls))
    return product_urls, category_urls


def parse_topking_category_page(text: str, url: str) -> Tuple[str, int, List[Dict[str, Any]]]:
    title_match = re.search(r"^Title:\s*(.+)$", text, re.M)
    title = normalize_space(title_match.group(1)) if title_match else None
    breadcrumbs = [m.group(1) for m in re.finditer(r"^\d+\.\s+\[(.*?)\]\((https?://[^)]+)\)", text, re.M)]
    category_path = normalize_topking_category_path(breadcrumbs)
    if not category_path and title:
        category_path = title

    total_match = re.search(r"We have found\s+(\d+)\s+products", text, re.I)
    total_products = int(total_match.group(1)) if total_match else None

    card_re = re.compile(
        r"\[!\[Image \d+: (?P<img_alt>.*?)\]\((?P<img_url>https?://[^)]+)\)\]\((?P<product_url>https?://[^)]+)\)\s*"
        r"### \[(?P<name>.*?)\]\((?P=product_url)\)\s*"
        r"(?P<body>.*?)(?=\n\[!\[Image \d+: |\Z)",
        re.S | re.M,
    )

    products: List[Dict[str, Any]] = []
    for match in card_re.finditer(text):
        body = match.group("body")
        lines = [normalize_space(line) for line in body.splitlines()]
        sku = first_nonempty(
            lines,
            skip={
                "Sold 0 items",
                "Sold 1 item",
                "Add to Cart",
                "Compare",
                "- [x] Compare",
                "New",
                "Quick shop",
                "See options",
            },
        )
        if sku:
            sku = sku.rstrip(".")
        price = None
        m = re.search(r"([0-9][0-9,]*(?:\.[0-9]+)?)\s*THB\s*฿\s*([0-9][0-9,]*(?:\.[0-9]+)?)", body, re.I)
        if m:
            price = parse_number(m.group(2) or m.group(1))
        status = "in stock" if "Add to Cart" in body else None
        if "Sold out" in body or "Out of stock" in body:
            status = "out of stock"
        if "Pre-order" in body or "Pre order" in body:
            status = "preorder"

        raw_img_url = match.group("img_url")
        image_url = raw_img_url
        if "lazy_default.png" in image_url or "/edid/16_16.png" in image_url:
            image_url = None
        products.append(
            {
                "product_id": product_id_from_url(match.group("product_url")),
                "product_url": canonical_topking_url(match.group("product_url")),
                "product_name": normalize_space(match.group("name")),
                "sku": sku,
                "category": category_path,
                "price": price,
                "currency": "THB",
                "stock_status": status,
                "image": image_url,
            }
        )
    return category_path or "", total_products or len(products), products


def fetch_topking_page(url: str) -> str:
    with _topking_fetch_lock:
        time.sleep(TOPKING_REQUEST_DELAY)
        return fetch_text(jina_url(url))


def parse_topking_product_page(text: str, requested_url: str) -> Dict[str, Any]:
    title_match = re.search(r"^Title:\s*(.+)$", text, re.M)
    title = normalize_space(title_match.group(1)) if title_match else None
    url_match = re.search(r"^URL Source:\s*(.+)$", text, re.M)
    source_url = normalize_space(url_match.group(1)) if url_match else None

    sku_match = re.search(r"^SKU\s*:\s*(.+)$", text, re.M)
    sku = normalize_space(sku_match.group(1)) if sku_match else None

    categories_match = re.search(r"^Categories\s*:\s*(.+)$", text, re.M)
    category_text = categories_match.group(1) if categories_match else ""
    category_names = re.findall(r"\[([^\]]+)\]\((https?://[^)]+)\)", category_text)
    categories = [name for name, _ in category_names]
    category_path = " > ".join([normalize_space(c) for c in categories if normalize_space(c)]) or None

    detail_match = re.search(r"^DETAILS\s*(.*?)\s*^### Related Product", text, re.S | re.M)
    full_description = detail_match.group(1).strip() if detail_match else None
    if full_description == "":
        full_description = None

    image_urls: List[str] = []
    if title:
        pre_title = text.split(f"# {title}", 1)[0]
        crumb_matches = list(re.finditer(rf"^\d+\.\s+\[{re.escape(title)}\]\(", pre_title, re.M))
        image_section = pre_title[crumb_matches[-1].end() :] if crumb_matches else pre_title
        for url in re.findall(r"https?://[^\s)\]]+", image_section):
            if "image.makewebcdn.com" not in url:
                continue
            if "DefaultData/LOGO" in url or "lazy_default.png" in url or "/edid/16_16.png" in url:
                continue
            if "/m_1920x0/" not in url:
                continue
            image_urls.append(url)
    image_urls = list(dict.fromkeys(image_urls))

    merged_tokens = " ".join([title or "", sku or ""])
    sizes = detect_tokens(merged_tokens, SIZE_PATTERNS)
    colors = detect_tokens(merged_tokens, COLOR_PATTERNS)
    colors = merge_unique(colors, detect_topking_color_codes(sku))
    variants = merge_unique([], sizes + colors)

    material_tokens = detect_tokens(" ".join([title or "", sku or "", category_path or "", full_description or ""]), MATERIAL_PATTERNS)
    material = material_tokens[0] if material_tokens else None
    if material == "genuine leather":
        material = "genuine leather"

    country = None
    if re.search(r"hand-?made in thailand|made in thailand|\bthailand\b", merged_tokens, re.I):
        country = "Thailand"

    return {
        "product_id": product_id_from_url(requested_url),
        "product_url": canonical_topking_url(requested_url),
        "product_name": title,
        "sku": sku,
        "category": category_path,
        "full_description": compact_html(full_description),
        "images": image_urls,
        "available_sizes": sizes,
        "available_colors": colors,
        "available_variants": variants,
        "material": material,
        "country_of_origin": country,
        "source_url": source_url,
    }


def build_topking_catalog() -> Dict[str, ProductAccumulator]:
    product_urls, category_urls = parse_topking_sitemap()
    print(f"[topking] sitemap: {len(category_urls)} categories, {len(product_urls)} products", file=sys.stderr, flush=True)
    product_map: Dict[str, ProductAccumulator] = {}
    page_jobs: List[str] = []
    category_failures: List[str] = []
    product_failures: List[str] = []

    first_page_results: List[Tuple[str, int, List[Dict[str, Any]], str]] = []
    with cf.ThreadPoolExecutor(max_workers=2) as executor:
        future_map = {executor.submit(fetch_topking_page, url): url for url in category_urls}
        for idx, future in enumerate(cf.as_completed(future_map), start=1):
            url = future_map[future]
            try:
                text = future.result()
            except Exception as exc:  # noqa: BLE001
                category_failures.append(url)
                print(f"[topking] category page failed: {url} ({exc})", file=sys.stderr, flush=True)
                continue
            category_path, total_products, cards = parse_topking_category_page(text, url)
            first_page_results.append((category_path, total_products, cards, url))
            if idx % 20 == 0:
                print(f"[topking] first pages done: {idx}/{len(category_urls)}", file=sys.stderr, flush=True)

    for category_path, total_products, cards, base_url in first_page_results:
        page_count = max(1, math.ceil(total_products / TOPKING_PAGE_SIZE))
        for page in range(2, page_count + 1):
            page_jobs.append(f"{base_url}&p={page}")
        for card in cards:
            key = card["product_id"]
            acc = product_map.get(key)
            if acc is None:
                acc = ProductAccumulator(brand="Top King", product_key=key)
                product_map[key] = acc
            acc.product_url = acc.product_url or card["product_url"]
            acc.product_name = acc.product_name or card["product_name"]
            acc.sku = acc.sku or card.get("sku")
            acc.price = acc.price if acc.price not in (None, 0, 0.0) else card.get("price")
            acc.currency = acc.currency or card.get("currency")
            acc.stock_status = acc.stock_status or card.get("stock_status")
            if card.get("image"):
                acc.merge_images([card["image"]])
            if category_path:
                acc.merge_categories([category_path])
            if card.get("category"):
                acc.merge_categories([card["category"]])

    if page_jobs:
        print(f"[topking] category pages to fetch: {len(page_jobs)}", file=sys.stderr, flush=True)
        with cf.ThreadPoolExecutor(max_workers=2) as executor:
            future_map = {executor.submit(fetch_topking_page, url): url for url in page_jobs}
            for idx, future in enumerate(cf.as_completed(future_map), start=1):
                page_url = future_map[future]
                try:
                    text = future.result()
                except Exception as exc:  # noqa: BLE001
                    category_failures.append(page_url)
                    print(f"[topking] category page failed: {page_url} ({exc})", file=sys.stderr, flush=True)
                    continue
                category_path, _, cards = parse_topking_category_page(text, page_url)
                for card in cards:
                    key = card["product_id"]
                    acc = product_map.get(key)
                    if acc is None:
                        acc = ProductAccumulator(brand="Top King", product_key=key)
                        product_map[key] = acc
                    acc.product_url = acc.product_url or card["product_url"]
                    acc.product_name = acc.product_name or card["product_name"]
                    acc.sku = acc.sku or card.get("sku")
                    acc.price = acc.price if acc.price not in (None, 0, 0.0) else card.get("price")
                    acc.currency = acc.currency or card.get("currency")
                    acc.stock_status = acc.stock_status or card.get("stock_status")
                    if card.get("image"):
                        acc.merge_images([card["image"]])
                    if category_path:
                        acc.merge_categories([category_path])
                    if card.get("category"):
                        acc.merge_categories([card["category"]])
                if idx % 20 == 0:
                    print(f"[topking] category pagination done: {idx}/{len(page_jobs)}", file=sys.stderr, flush=True)

    discovered_urls = [acc.product_url for acc in product_map.values() if acc.product_url]
    unique_product_urls = list(dict.fromkeys([*product_urls, *discovered_urls]))
    print(f"[topking] product pages to fetch: {len(unique_product_urls)}", file=sys.stderr, flush=True)
    with cf.ThreadPoolExecutor(max_workers=2) as executor:
        future_map = {executor.submit(fetch_topking_page, url): url for url in unique_product_urls}
        for idx, future in enumerate(cf.as_completed(future_map), start=1):
            requested_url = future_map[future]
            try:
                text = future.result()
            except Exception as exc:  # noqa: BLE001
                product_failures.append(requested_url)
                print(f"[topking] product page failed: {requested_url} ({exc})", file=sys.stderr, flush=True)
                continue
            data = parse_topking_product_page(text, requested_url)
            key = data["product_id"]
            acc = product_map.get(key)
            if acc is None:
                acc = ProductAccumulator(brand="Top King", product_key=key)
                product_map[key] = acc
            acc.product_url = acc.product_url or data.get("product_url")
            acc.product_name = acc.product_name or data.get("product_name")
            acc.sku = acc.sku or data.get("sku")
            if data.get("category"):
                acc.merge_categories([data["category"]])
            if data.get("full_description"):
                acc.full_description = acc.full_description or data["full_description"]
            if data.get("images"):
                acc.merge_images(data["images"])
            acc.merge_sizes(data.get("available_sizes") or [])
            acc.merge_colors(data.get("available_colors") or [])
            acc.merge_variants(data.get("available_variants") or [])
            acc.material = acc.material or data.get("material")
            acc.country_of_origin = acc.country_of_origin or data.get("country_of_origin")
            if acc.price in (None, 0, 0.0) and data.get("price") not in (None, "", 0, 0.0):
                acc.price = data.get("price")
            if idx % 50 == 0:
                print(f"[topking] product pages done: {idx}/{len(unique_product_urls)}", file=sys.stderr, flush=True)

    if category_failures:
        print(f"[topking] category failures: {len(category_failures)}", file=sys.stderr, flush=True)
    if product_failures:
        print(f"[topking] product failures: {len(product_failures)}", file=sys.stderr, flush=True)
    return product_map


def validate_image_urls(products: Sequence[Dict[str, Any]]) -> None:
    image_urls = []
    for product in products:
        for url in product.get("images") or []:
            if url:
                image_urls.append(url)
    unique_urls = list(dict.fromkeys(image_urls))

    def check(url: str) -> Tuple[str, bool]:
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                resp = get_session().head(url, timeout=30, allow_redirects=True)
                if resp.status_code in {405, 403}:
                    resp = get_session().get(url, timeout=30, stream=True)
                return url, resp.status_code < 400
            except Exception:  # noqa: BLE001
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(min(4.0, 1.2 ** attempt))
        return url, False

    failures: List[str] = []
    with cf.ThreadPoolExecutor(max_workers=20) as executor:
        for url, ok in executor.map(check, unique_urls):
            if not ok:
                failures.append(url)
    if failures:
        raise RuntimeError(f"Image validation failed for {len(failures)} URLs; first: {failures[0]}")


def finalize_products(product_map: Dict[str, ProductAccumulator]) -> List[Dict[str, Any]]:
    products = [acc.finalize() for acc in product_map.values()]
    products.sort(key=lambda p: (p["brand"] or "", p["product_name"] or "", p["product_url"] or ""))
    return products


def product_text(product: Dict[str, Any]) -> str:
    return " ".join(
        [
            str(product.get("product_name") or ""),
            str(product.get("category") or ""),
            str(product.get("sku") or ""),
            str(product.get("full_description") or ""),
        ]
    ).lower()


def is_wrap_product(product: Dict[str, Any]) -> bool:
    text = product_text(product)
    return "wrap" in text or "venda" in text


def is_shinguard_product(product: Dict[str, Any]) -> bool:
    text = product_text(product)
    return "shin guard" in text or "shinguard" in text or "shin pad" in text


def is_headgear_product(product: Dict[str, Any]) -> bool:
    text = product_text(product)
    return any(token in text for token in ["head guard", "headguard", "head gear", "headgear", "helmet", "casco"])


def is_boxing_glove_product(product: Dict[str, Any]) -> bool:
    text = product_text(product)
    if "glove" not in text:
        return False
    excluded = [
        "bag mitt",
        "focus mitt",
        "bag glove",
        "bag gloves",
        "mma glove",
        "wrap",
        "keyring",
        "key chain",
        "keychain",
        "kids boxing gloves",
        "kid's boxing gloves",
    ]
    if any(token in text for token in excluded):
        return False
    return True


def normalize_match_sku(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    sku = normalize_space(value.upper())
    if not sku:
        return None
    sku = re.sub(r"-(?:\d+\s*OZ|XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)$", "", sku, flags=re.I)
    return sku


def normalize_match_title(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = value.lower()
    replacements = {
        "&": " and ",
        "/": " ",
        "|": " ",
        "-": " ",
        "'": "",
        '"': "",
        "top king": "topking",
        "top kingboxing": "topking",
        "top kingshin": "topking shin",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\b(?:boxing|muay thai|training|gloves|glove|shorts|shin guards|shin guard|head guard|headgear|helmet|hand wraps|wraps|ankle guards|ankle guard|mma)\b", " ", text)
    text = re.sub(r"\b(?:small|medium|large|x large|x-large|\d+\s*oz)\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def fetch_topking_usa_price_map() -> Dict[str, Any]:
    products: List[Dict[str, Any]] = []
    page = 1
    while True:
        data = fetch_json(f"https://topkingboxingusa.com/products.json?limit=250&page={page}")
        batch = data.get("products", []) or []
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 250:
            break
        page += 1

    mapped_products: List[Dict[str, Any]] = []
    exact_sku_map: Dict[str, Dict[str, Any]] = {}
    root_sku_map: Dict[str, Dict[str, Any]] = {}
    title_map: Dict[str, Dict[str, Any]] = {}
    fallback_prices: Dict[str, List[float]] = defaultdict(list)

    for raw in products:
        variant_prices: List[float] = []
        variant_skus: List[str] = []
        for variant in raw.get("variants", []) or []:
            try:
                variant_prices.append(float(variant.get("price")))
            except (TypeError, ValueError):
                pass
            sku = normalize_space(str(variant.get("sku") or "")).upper()
            if sku:
                variant_skus.append(sku)
        if not variant_prices:
            continue

        item = {
            "title": raw.get("title"),
            "handle": raw.get("handle"),
            "product_type": normalize_space(str(raw.get("product_type") or "")),
            "price": min(variant_prices),
            "skus": variant_skus,
        }
        mapped_products.append(item)

        normalized_title = normalize_match_title(item["title"])
        if normalized_title and normalized_title not in title_map:
            title_map[normalized_title] = item

        for sku in variant_skus:
            exact_sku_map[sku] = item
            root = normalize_match_sku(sku)
            if root and root not in root_sku_map:
                root_sku_map[root] = item

        product_type = (item["product_type"] or "").lower()
        if product_type:
            fallback_prices[product_type].append(item["price"])

    fallback_min = {key: min(values) for key, values in fallback_prices.items() if values}
    return {
        "products": mapped_products,
        "exact_sku_map": exact_sku_map,
        "root_sku_map": root_sku_map,
        "title_map": title_map,
        "fallback_min": fallback_min,
    }


def apply_boon_price_rules(products: List[Dict[str, Any]]) -> None:
    for product in products:
        if product.get("brand") != "Boon":
            continue
        if is_boxing_glove_product(product):
            product["available_sizes"] = STANDARD_GLOVE_SIZES[:]
            product["available_variants"] = merge_unique(product.get("available_variants") or [], STANDARD_GLOVE_SIZES)
        if is_shinguard_product(product) or is_headgear_product(product):
            product["available_sizes"] = STANDARD_PROTECTION_SIZES[:]
            product["available_variants"] = merge_unique(product.get("available_variants") or [], STANDARD_PROTECTION_SIZES)
        product["stock_status"] = "in stock"

        text = product_text(product)
        name_text = " ".join([str(product.get("product_name") or ""), str(product.get("sku") or "")]).lower()
        if "lace" in name_text and "glove" in name_text:
            product["price"] = 139
            product["currency"] = "USD"
        elif "glove" in text or is_shinguard_product(product) or is_headgear_product(product):
            product["price"] = 149
            product["currency"] = "USD"
        elif product.get("price") is not None:
            product["currency"] = "USD"


def apply_topking_rules(products: List[Dict[str, Any]]) -> None:
    usa_map = fetch_topking_usa_price_map()
    exact_sku_map = usa_map["exact_sku_map"]
    root_sku_map = usa_map["root_sku_map"]
    title_map = usa_map["title_map"]
    fallback_min = usa_map["fallback_min"]

    for product in products:
        if product.get("brand") != "Top King":
            continue

        if is_boxing_glove_product(product):
            product["available_sizes"] = STANDARD_GLOVE_SIZES[:]
            product["available_variants"] = merge_unique(product.get("available_variants") or [], STANDARD_GLOVE_SIZES)
        if is_shinguard_product(product) or is_headgear_product(product):
            product["available_sizes"] = STANDARD_PROTECTION_SIZES[:]
            product["available_variants"] = merge_unique(product.get("available_variants") or [], STANDARD_PROTECTION_SIZES)
        product["stock_status"] = "in stock"

        sku = normalize_space(str(product.get("sku") or "")).upper() or None
        sku_root = normalize_match_sku(sku)
        title_key = normalize_match_title(product.get("product_name"))
        matched = None
        if sku and sku in exact_sku_map:
            matched = exact_sku_map[sku]
        elif sku_root and sku_root in root_sku_map:
            matched = root_sku_map[sku_root]
        elif title_key and title_key in title_map:
            matched = title_map[title_key]

        base_price: Optional[float] = None
        if matched:
            base_price = float(matched["price"])
        else:
            text = product_text(product)
            if is_wrap_product(product):
                base_price = fallback_min.get("hand wraps")
            elif is_shinguard_product(product):
                base_price = fallback_min.get("shin guards")
            elif is_headgear_product(product):
                base_price = fallback_min.get("shin guards")
            elif "focus mitt" in text:
                base_price = 119.95
            elif "speed paddle" in text:
                base_price = 109.95
            elif "kicking pad" in text or "kicking shield" in text:
                base_price = 179.95
            elif "belly protector" in text or "body protector" in text or "thigh protection" in text or "thigh pad" in text:
                base_price = 149.95
            elif "groin protector" in text or "abdominal protector" in text:
                base_price = 69.95
            elif "mouth guard" in text or "elbow pad" in text:
                base_price = 14.95
            elif "mongkol" in text or "prajead" in text:
                base_price = 19.95
            elif "skipping rope" in text:
                base_price = 18.95
            elif "sauna suit" in text:
                base_price = 45.95
            elif "competition boxing ring" in text:
                base_price = 1999.95
            elif "ring skirt" in text:
                base_price = 299.95
            elif "corner pad" in text:
                base_price = 149.95
            elif "rope spacer" in text or "rope clamp" in text:
                base_price = 29.95
            elif "mma glove" in text:
                base_price = fallback_min.get("mma gloves")
            elif is_boxing_glove_product(product):
                base_price = fallback_min.get("boxing gloves")
            elif "short" in text:
                base_price = fallback_min.get("muay thai shorts")
            elif "jacket" in text or "hoodie" in text or "track suit" in text or "tracksuit" in text or "fighter robe" in text:
                base_price = fallback_min.get("tracksuit") or 84.95
            elif "t-shirt" in text or "t shirt" in text or "shirt" in text:
                base_price = fallback_min.get("t-shirt") or fallback_min.get("sleeveless t-shirt")
            elif "ankle guard" in text:
                base_price = fallback_min.get("ankle guards")
            elif "keyring" in text or "key chain" in text or "keychain" in text:
                base_price = fallback_min.get("keyring")
            elif "backpack" in text or "bag" in text:
                base_price = fallback_min.get("bag")

        if base_price is not None:
            final_price = base_price if is_wrap_product(product) else base_price + 10.0
            product["price"] = round(final_price, 2)
            product["currency"] = "USD"
        elif product.get("price") in (0, 0.0):
            product["price"] = None
            product["currency"] = "USD"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="output/boon_topking_products.json")
    parser.add_argument("--validate-images", action="store_true", default=True)
    parser.add_argument("--no-validate-images", action="store_false", dest="validate_images")
    args = parser.parse_args()

    boon_map = build_boon_catalog()
    topking_map = build_topking_catalog()

    combined_map: Dict[Tuple[str, str], ProductAccumulator] = {}
    for brand_map in [boon_map, topking_map]:
        for key, acc in brand_map.items():
            combined_key = (acc.brand, key)
            existing = combined_map.get(combined_key)
            if existing is None:
                combined_map[combined_key] = acc
                continue
            existing.product_name = existing.product_name or acc.product_name
            existing.sku = existing.sku or acc.sku
            existing.product_url = existing.product_url or acc.product_url
            existing.short_description = existing.short_description or acc.short_description
            existing.full_description = existing.full_description or acc.full_description
            if existing.price in (None, 0, 0.0):
                existing.price = acc.price
            existing.currency = existing.currency or acc.currency
            existing.merge_sizes(acc.available_sizes)
            existing.merge_colors(acc.available_colors)
            existing.merge_variants(acc.available_variants)
            existing.material = existing.material or acc.material
            existing.weight = existing.weight or acc.weight
            existing.country_of_origin = existing.country_of_origin or acc.country_of_origin
            existing.stock_status = existing.stock_status or acc.stock_status
            existing.merge_images(acc.images)
            existing.merge_categories(acc.categories)

    products = finalize_products(combined_map)
    apply_boon_price_rules(products)
    apply_topking_rules(products)
    seen_keys = set()
    for product in products:
        key = (product["brand"], product["product_url"])
        if key in seen_keys:
            raise RuntimeError(f"Duplicate product detected: {key}")
        seen_keys.add(key)

    if args.validate_images:
        validate_image_urls(products)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(products, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(output_path)


if __name__ == "__main__":
    main()
