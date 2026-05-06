import gzip
import json
import ssl
import urllib.parse
import urllib.request
import zlib

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nike.com",
    "Referer": "https://www.nike.com/",
}
BASE = "https://api.nike.com/product_feed/threads/v2/"
COMMON = [
    "marketplace(US)",
    "language(en)",
    "channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)",
]
TESTS = {
    "base_200": [],
    "active": ["productInfo.merchProduct.status(ACTIVE)"],
    "nike_brand": ["productInfo.merchProduct.brand(Nike)"],
    "active_nike": ["productInfo.merchProduct.status(ACTIVE)", "productInfo.merchProduct.brand(Nike)"],
    "footwear": ["productInfo.merchProduct.productType(FOOTWEAR)"],
    "apparel": ["productInfo.merchProduct.productType(APPAREL)"],
    "equipment": ["productInfo.merchProduct.productType(EQUIPMENT)"],
    "active_footwear": ["productInfo.merchProduct.status(ACTIVE)", "productInfo.merchProduct.productType(FOOTWEAR)"],
}


def build(filters):
    params = [("filter", item) for item in COMMON + filters]
    params.append(("count", "100"))
    return BASE + "?" + urllib.parse.urlencode(params)


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return json.loads(raw)


for name, filters in TESTS.items():
    try:
        data = fetch(build(filters))
        pages = data.get("pages", {})
        objects = data.get("objects", [])
        active = sum(1 for obj in objects for item in obj.get("productInfo", []) if item.get("merchProduct", {}).get("status") == "ACTIVE")
        brands = sorted({item.get("merchProduct", {}).get("brand") for obj in objects for item in obj.get("productInfo", []) if item.get("merchProduct", {}).get("brand")})[:8]
        types = sorted({item.get("merchProduct", {}).get("productType") for obj in objects for item in obj.get("productInfo", []) if item.get("merchProduct", {}).get("productType")})[:8]
        first = objects[0].get("publishedContent", {}).get("properties", {}).get("title") if objects else ""
        print(f"{name:16s} total={pages.get('totalResources')} pages={pages.get('totalPages')} objects={len(objects)} active_in_page={active} brands={brands} types={types} first={first}")
    except Exception as exc:
        print(f"{name:16s} ERR {type(exc).__name__}: {str(exc)[:100]}")
