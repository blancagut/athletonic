import gzip
import json
import ssl
import socket
import urllib.request
import zlib

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
socket.setdefaulttimeout(8)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

BRANDS = {
    "alo_yoga": ["https://www.aloyoga.com", "https://aloyoga.com"],
    "lululemon": ["https://shop.lululemon.com", "https://www.lululemon.com"],
    "vuori": ["https://vuoriclothing.com", "https://www.vuoriclothing.com"],
    "ten_thousand": ["https://www.tenthousand.cc", "https://tenthousand.cc"],
    "on_running": ["https://www.on.com", "https://on.com"],
    "allbirds": ["https://www.allbirds.com", "https://allbirds.com"],
    "arcteryx": ["https://arcteryx.com", "https://www.arcteryx.com"],
    "patagonia": ["https://www.patagonia.com", "https://patagonia.com"],
    "rhone": ["https://www.rhone.com", "https://rhone.com"],
    "outdoor_voices": ["https://www.outdoorvoices.com", "https://outdoorvoices.com"],
}

HINTS = [
    "shopify",
    "demandware",
    "salesforce",
    "magento",
    "bigcommerce",
    "woocommerce",
    "__next_data__",
    "algolia",
    "constructor.io",
    "bloomreach",
    "searchspring",
    "cdn.shopify.com",
]


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=8, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return resp.status, raw


for slug, bases in BRANDS.items():
    found = False
    for base in bases:
        try:
            _status, raw = fetch(f"{base.rstrip('/')}/products.json?limit=250")
            products = json.loads(raw).get("products", [])
            print(f"{slug:18s} SHOPIFY {len(products):3d} {base}", flush=True)
            found = True
            break
        except Exception:
            pass
    if found:
        continue

    for base in bases[:1]:
        try:
            status, raw = fetch(base)
            text = raw.decode("utf-8", errors="ignore")
            lowered = text[:80000].lower()
            hints = [hint for hint in HINTS if hint in lowered]
            print(f"{slug:18s} NO_SHOPIFY root={status} hints={hints} {base}", flush=True)
        except Exception as exc:
            print(f"{slug:18s} ERR {type(exc).__name__}: {str(exc)[:90]}", flush=True)
