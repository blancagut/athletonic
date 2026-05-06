import gzip
import json
import ssl
import urllib.request
import zlib

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}
SOURCES = {
    "fifa_store": "https://store.fifa.com",
    "soccer_post": "https://soccerpost.com",
    "soccer90": "https://soccer90.com",
    "azteca_soccer": "https://aztecasoccer.com",
    "soccer_zone_usa": "https://soccerzoneusa.com",
    "football_town": "https://footballtown.com",
    "away_days": "https://awaydaysfootball.com",
    "golaco_kits": "https://golacokits.com",
}


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


for slug, base in SOURCES.items():
    total = 0
    page = 1
    jersey = 0
    accessory = 0
    vendors = set()
    sample = []
    while True:
        data = fetch(f"{base.rstrip('/')}/products.json?limit=250&page={page}")
        products = data.get("products", [])
        if not products:
            break
        total += len(products)
        for product in products:
            text = " ".join(str(product.get(key) or "") for key in ["title", "product_type", "vendor"]).lower()
            text += " " + " ".join(product.get("tags") or []).lower()
            if any(word in text for word in ["jersey", "shirt", "kit", "home", "away", "third", "goalkeeper"]):
                jersey += 1
            if any(word in text for word in ["ball", "scarf", "cap", "hat", "sock", "bag", "glove", "training", "short", "pant", "jacket", "accessor"]):
                accessory += 1
            if product.get("vendor"):
                vendors.add(product["vendor"])
            if len(sample) < 3:
                sample.append(product.get("title", ""))
        if len(products) < 250:
            break
        page += 1
        if page > 80:
            break
    print(f"{slug:16s} total={total:5d} jersey_like={jersey:5d} accessory_like={accessory:5d} pages={page:3d} vendors={len(vendors):4d} sample={sample}")
