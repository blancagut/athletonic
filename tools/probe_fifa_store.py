import gzip
import json
import re
import ssl
import urllib.request
import zlib
from collections import Counter

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}
BASE = "https://store.fifa.com"


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return resp.status, resp.headers, raw


urls = [
    f"{BASE}/products.json?limit=250",
    f"{BASE}/en-us/products.json?limit=250",
    f"{BASE}/collections/all/products.json?limit=250",
    f"{BASE}/en-us/collections/all/products.json?limit=250",
    f"{BASE}/collections/world-cup-2026/products.json?limit=250",
    f"{BASE}/en-us/collections/world-cup-2026/products.json?limit=250",
]
for url in urls:
    try:
        status, _headers, raw = fetch(url)
        data = json.loads(raw)
        products = data.get("products", [])
        print(f"{url} OK products={len(products)} first={(products[0].get('title') if products else '')[:80]}")
    except Exception as exc:
        print(f"{url} ERR {type(exc).__name__}: {str(exc)[:100]}")

status, _headers, raw = fetch(f"{BASE}/en-us/")
html = raw.decode("utf-8", errors="ignore")
handles = sorted(set(re.findall(r"/en-us/collections/([a-zA-Z0-9_-]+)", html)))
print("\ncollection handles", len(handles), handles[:120])
product_handles = sorted(set(re.findall(r"/en-us/products/([a-zA-Z0-9_-]+)", html)))
print("product handles on home", len(product_handles), product_handles[:30])

try:
    status, _headers, raw = fetch(f"{BASE}/sitemap.xml")
    sitemap = raw.decode("utf-8", errors="ignore")
    sitemaps = re.findall(r"<loc>([^<]+)</loc>", sitemap)
    print("sitemap locs", len(sitemaps), sitemaps[:20])
except Exception as exc:
    print("sitemap ERR", exc)
