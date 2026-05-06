"""Probe sitemap-based product extraction."""
import urllib.request, ssl, certifi, gzip, zlib, re, json

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept-Encoding": "gzip, deflate",
}
def get(url):
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        raw = r.read()
        enc = r.headers.get("Content-Encoding")
        if enc == "gzip": raw = gzip.decompress(raw)
        elif enc == "deflate": raw = zlib.decompress(raw)
        return r.status, raw

# Huel US sitemap content
print("=== Huel US sitemap ===")
try:
    s, raw = get("https://huel.com/sitemaps/sitemap/en-us.xml")
    body = raw.decode("utf-8", errors="replace")
    print(f"status={s} len={len(body)}")
    # find product URLs
    locs = re.findall(r"<loc>([^<]+)</loc>", body)
    products = [l for l in locs if "/product" in l.lower()]
    print(f"  total locs: {len(locs)}")
    print(f"  product locs: {len(products)}")
    for p in products[:10]: print(f"    {p}")
except Exception as e:
    print("ERR", e)

# Hum sitemap
print("\n=== Hum sitemap ===")
try:
    s, raw = get("https://www.humnutrition.com/sitemap.xml")
    body = raw.decode("utf-8", errors="replace")
    locs = re.findall(r"<loc>([^<]+)</loc>", body)
    products = [l for l in locs if "/products/" in l]
    print(f"  total locs: {len(locs)}, products: {len(products)}")
    for p in products[:5]: print(f"    {p}")
    # Try .json on first
    if products:
        for cand in [products[0]+".json", products[0]+".js"]:
            try:
                s, b = get(cand)
                print(f"  {cand} -> {s} len={len(b)}")
            except Exception as e:
                print(f"  {cand} ERR {str(e)[:60]}")
except Exception as e:
    print("ERR", e)

# Try Huel product .json
print("\n=== Huel product .json test ===")
try:
    s, raw = get("https://huel.com/products/black-edition")
    body = raw.decode("utf-8", errors="replace")
    print(f"  /products/black-edition -> {s} len={len(body)}")
    for cand in ["https://huel.com/products/black-edition.json", "https://huel.com/products/black-edition.js"]:
        try:
            s, b = get(cand); print(f"  {cand} -> {s} len={len(b)}")
        except Exception as e:
            print(f"  {cand} ERR {str(e)[:60]}")
except Exception as e:
    print("ERR", e)

# Try kachava products.json — confirm size
print("\n=== Kachava confirm ===")
try:
    s, raw = get("https://kachava.com/products.json?limit=250")
    d = json.loads(raw)
    print(f"  products: {len(d.get('products',[]))}")
except Exception as e:
    print("ERR", e)

# Try shop.truvani.com confirm
print("\n=== Truvani confirm ===")
try:
    s, raw = get("https://shop.truvani.com/products.json?limit=250")
    d = json.loads(raw)
    print(f"  products: {len(d.get('products',[]))}")
except Exception as e:
    print("ERR", e)
