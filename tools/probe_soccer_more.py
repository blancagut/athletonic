import gzip
import json
import re
import ssl
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
    "fifa_store": "https://store.fifa.com",
    "soccer_post": "https://soccerpost.com",
    "wegotsoccer": "https://www.wegotsoccer.com",
    "soccer_pro": "https://www.soccerpro.com",
    "soccer90": "https://soccer90.com",
    "azteca_soccer": "https://aztecasoccer.com",
    "soccer_zone_usa": "https://soccerzoneusa.com",
    "authentic_soccer": "https://authenticsoccer.com",
    "football_town": "https://footballtown.com",
    "classic_football_shirts": "https://www.classicfootballshirts.com",
    "uksoccershop": "https://www.uksoccershop.com",
    "subside_sports": "https://www.subsidesports.com",
    "futbol_world_shop": "https://futbolworldshop.com",
    "away_days": "https://awaydaysfootball.com",
    "golaco_kits": "https://golacokits.com",
    "cult_kits": "https://www.cultkits.com",
}

HINTS = [
    "shopify",
    "cdn.shopify.com",
    "woocommerce",
    "bigcommerce",
    "magento",
    "demandware",
    "salesforce",
    "__next_data__",
    "algolia",
    "searchspring",
    "constructor.io",
    "bloomreach",
    "graphql",
    "price",
    "currency",
]


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return resp.status, resp.headers, raw


for slug, base in SOURCES.items():
    print(f"\n== {slug} {base} ==", flush=True)
    for endpoint in ["/products.json?limit=250", "/collections/all/products.json?limit=250"]:
        url = base.rstrip("/") + endpoint
        try:
            status, headers, raw = fetch(url)
            data = json.loads(raw)
            products = data.get("products", [])
            first = products[0] if products else {}
            print(
                f"SHOPIFY {endpoint} products={len(products)} first={first.get('title', '')[:90]!r} vendor={first.get('vendor', '')!r} type={first.get('product_type', '')!r}",
                flush=True,
            )
        except Exception as exc:
            print(f"NO {endpoint} {type(exc).__name__}: {str(exc)[:80]}", flush=True)
    try:
        status, headers, raw = fetch(base)
        text = raw.decode("utf-8", errors="ignore")
        lower = text[:120000].lower()
        hints = [hint for hint in HINTS if hint in lower]
        title = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
        curr = sorted(set(re.findall(r"\b[A-Z]{3}\b", text[:120000])))[:20]
        print(f"ROOT {status} title={(title.group(1).strip()[:100] if title else '')!r} hints={hints} currency_like={curr} len={len(text)}", flush=True)
    except Exception as exc:
        print(f"ROOT ERR {type(exc).__name__}: {str(exc)[:100]}", flush=True)
