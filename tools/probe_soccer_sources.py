import gzip
import json
import re
import ssl
import urllib.parse
import urllib.request
import zlib

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

SOURCES = {
    "fifa_store": [
        "https://store.fifa.com/en-us/",
        "https://store.fifa.com/en-us/search?q=jersey",
        "https://store.fifa.com/en-us/collections/national-teams",
    ],
    "fanatics": [
        "https://www.fanatics.com/soccer/o-2545+z-93379282-3774741840",
        "https://www.fanatics.com/search/jersey?q=soccer%20jersey",
    ],
    "soccer_com": [
        "https://www.soccer.com/",
        "https://www.soccer.com/search?query=national%20team%20jersey",
        "https://www.soccer.com/search?query=world%20cup%20jersey",
    ],
    "world_soccer_shop": [
        "https://www.worldsoccershop.com/",
        "https://www.worldsoccershop.com/shop/national-teams/",
        "https://www.worldsoccershop.com/search?q=world%20cup%20jersey",
    ],
    "nike": [
        "https://api.nike.com/product_feed/threads/v2/?filter=marketplace(US)&filter=language(en)&filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)&filter=productInfo.merchProduct.status(ACTIVE)&count=100",
    ],
    "adidas": [
        "https://www.adidas.com/us/search?q=soccer%20jersey",
        "https://www.adidas.com/api/plp/content-engine/search?sitePath=us&query=soccer%20jersey",
        "https://www.adidas.com/api/search/product/soccer%20jersey?sitePath=us",
    ],
    "puma": [
        "https://us.puma.com/us/en/search?q=soccer%20jersey",
        "https://us.puma.com/us/en/sports/soccer",
    ],
}

HINTS = [
    "__next_data__",
    "apollo",
    "algolia",
    "constructor.io",
    "bloomreach",
    "searchspring",
    "demandware",
    "salesforce",
    "fanatics",
    "graphql",
    "productsearch",
    "plp",
    "window.__",
    "shopify",
    "cdn.shopify.com",
    "price",
]


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=18, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return resp.status, resp.headers, raw


for source, urls in SOURCES.items():
    print(f"\n== {source} ==", flush=True)
    for url in urls:
        try:
            status, headers, raw = fetch(url)
            content_type = headers.get("Content-Type", "")
            text = raw.decode("utf-8", errors="ignore")
            if "json" in content_type or text[:1] in "[{":
                try:
                    data = json.loads(text)
                    print(f"{status} JSON {url} keys={list(data)[:10]} len={len(text)}", flush=True)
                    print(json.dumps(data, indent=2)[:900].replace("\n", " "), flush=True)
                    continue
                except Exception:
                    pass
            lowered = text[:120000].lower()
            hints = [hint for hint in HINTS if hint in lowered]
            title = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
            print(f"{status} HTML {url} title={(title.group(1).strip()[:80] if title else '')!r} hints={hints} len={len(text)}", flush=True)
        except Exception as exc:
            print(f"ERR {url} {type(exc).__name__}: {str(exc)[:120]}", flush=True)
