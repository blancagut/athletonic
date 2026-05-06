"""Inspect Huel sitemap + try Truvani no-www + LMNT product-page extraction."""
import urllib.request, ssl, certifi, gzip, zlib, re, json

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept-Encoding": "gzip, deflate",
}

def get(url):
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        raw = r.read()
        enc = r.headers.get("Content-Encoding")
        if enc == "gzip": raw = gzip.decompress(raw)
        elif enc == "deflate": raw = zlib.decompress(raw)
        return r.status, raw.decode("utf-8", errors="replace")

# 1. Huel sitemap content
print("=== Huel sitemap ===")
try:
    s, body = get("https://huel.com/sitemap.xml")
    print(body[:1500])
except Exception as e:
    print("ERR", e)

# 2. BiOptimizers WP sitemap
print("\n=== BiOptimizers sitemap ===")
try:
    s, body = get("https://bioptimizers.com/sitemap.xml")
    print(body[:1500])
except Exception as e:
    print("ERR", e)

# 3. Truvani — try various
print("\n=== Truvani ===")
for url in ["https://truvani.com/products.json?limit=1", "https://truvani.com/", "https://shop.truvani.com/products.json?limit=1"]:
    try:
        s, body = get(url)
        print(f"{url} -> {s} len={len(body)}")
        if "products" in body[:5000].lower() and "{" in body[:200]:
            try:
                d = json.loads(body); print(f"  JSON products={len(d.get('products',[]))}")
            except: pass
        m = re.search(r"shopify|magento|wordpress|next\.js|gatsby", body[:5000], re.I)
        if m: print(f"  platform hint: {m.group(0)}")
    except Exception as e:
        print(f"{url} ERR {e}")

# 4. LMNT — find product handles in homepage HTML
print("\n=== LMNT product hunt ===")
try:
    s, body = get("https://drinklmnt.com/")
    handles = set(re.findall(r"/products/([a-z0-9-]+)", body))
    print(f"  product handles found: {len(handles)} -> {sorted(handles)[:20]}")
    # Try .json on each
    for h in list(handles)[:3]:
        try:
            s, b = get(f"https://drinklmnt.com/products/{h}.js")
            print(f"  /products/{h}.js -> {s} len={len(b)}")
        except Exception as e:
            print(f"  /products/{h}.js ERR {e}")
except Exception as e:
    print("ERR", e)
