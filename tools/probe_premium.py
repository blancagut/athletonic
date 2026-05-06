import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

CANDIDATES = [
    # Bucked Up
    ("buckedup",            "https://www.buckedup.com/products.json?limit=1"),
    ("buckedup_alt",        "https://buckedup.com/products.json?limit=1"),
    # Beyond Raw — GNC's brand
    ("beyondraw_direct",    "https://www.beyondraw.com/products.json?limit=1"),
    ("beyondraw_root",      "https://www.beyondraw.com/"),
    ("gnc_pj",              "https://www.gnc.com/products.json?limit=1"),
    # JYM
    ("jym",                 "https://www.jymsupplementscience.com/products.json?limit=1"),
    ("jym_alt",             "https://jymsupplementscience.com/products.json?limit=1"),
    # Animal Pak (Universal Nutrition)
    ("animalpak",           "https://animalpak.com/products.json?limit=1"),
    ("universal",           "https://www.universalusa.com/products.json?limit=1"),
    ("universalnutrition",  "https://universalnutrition.com/products.json?limit=1"),
]

for name, url in CANDIDATES:
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw); print(f"{name:25s} {r.status} JSON products={len(d.get('products',[]))}")
            except:
                head = raw[:5000].decode("utf-8", errors="replace").lower()
                hint = "shopify" if "shopify" in head else ("magento" if "magento" in head else "unknown")
                print(f"{name:25s} {r.status} HTML ({hint}) len={len(raw)}")
    except Exception as e:
        print(f"{name:25s} ERR {type(e).__name__}: {str(e)[:80]}")
