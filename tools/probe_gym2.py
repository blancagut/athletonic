"""Probe blocked gym brands harder + check alternative endpoints."""
import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}

def get(url, hdr=HDR):
    req = urllib.request.Request(url, headers=hdr)
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        raw = r.read()
        enc = r.headers.get("Content-Encoding")
        if enc == "gzip": raw = gzip.decompress(raw)
        elif enc == "deflate": raw = zlib.decompress(raw)
        return r.status, raw

CANDIDATES = [
    # gymshark accessories — try US site, products.json
    ("gymshark_us", "https://www.gymshark.com/products.json?limit=1"),
    ("gymshark_us_root", "https://www.gymshark.com/"),
    # rogue is Magento — try sitemap
    ("rogue_sitemap", "https://www.roguefitness.com/sitemap.xml"),
    # dark iron fitness — root
    ("dark_iron_root", "https://darkironfitness.com/"),
    ("dark_iron_pj",   "https://darkironfitness.com/products.json?limit=1"),
    # theraband
    ("theraband_root", "https://www.theraband.com/"),
    ("theraband_pj",   "https://www.theraband.com/products.json?limit=1"),
    ("theraband_us",   "https://www.theraband.com/us/products.json?limit=1"),
    ("theraband_shop", "https://shop.theraband.com/products.json?limit=1"),
]

for name, url in CANDIDATES:
    try:
        status, raw = get(url)
        ct = "?"
        try:
            d = json.loads(raw); ct = f"json products={len(d.get('products',[]))}"
        except Exception:
            head = raw[:200].decode("utf-8", errors="replace")
            if "shopify" in head.lower() or "shopify" in raw[:5000].decode("utf-8", errors="replace").lower():
                ct = "html (shopify hint)"
            elif "magento" in raw[:5000].decode("utf-8", errors="replace").lower():
                ct = "html (magento)"
            else:
                ct = f"html len={len(raw)}"
        print(f"{name:25s} {status} {ct}")
    except Exception as e:
        print(f"{name:25s} ERR {type(e).__name__}: {e}")
