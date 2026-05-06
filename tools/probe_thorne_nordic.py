import socket; socket.setdefaulttimeout(10)
import urllib.request, ssl, certifi, re, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDRS = {"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":"en-US,en;q=0.9"}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=HDRS)
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return f"ERR:{type(e).__name__}", b""

# THORNE: probe API endpoints
print("=== Thorne API probes ===")
for path in ["/api/products?limit=5", "/api/v2/products", "/api/catalog/products"]:
    code, body = fetch(f"https://www.thorne.com{path}")
    snippet = body[:140].decode("utf-8","ignore") if body else ""
    print(f"  {path}: {code} len={len(body)} -> {snippet[:120]}")

# /products HTML
code, body = fetch("https://www.thorne.com/products")
txt = body.decode("utf-8","ignore")
print(f"\nThorne /products status={code} len={len(body)}")
links = set(re.findall(r'href="(/products/[^"?#]+)"', txt))
print(f"  product links: {len(links)}")
for l in list(links)[:5]: print(f"    {l}")

# NEXT_DATA
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', txt, re.S)
if m:
    print(f"  __NEXT_DATA__: len={len(m.group(1))}")
    try:
        data = json.loads(m.group(1))
        # Find all lists with > 20 product-like items
        def walk(o, path=""):
            if isinstance(o, dict):
                for k,v in o.items():
                    if isinstance(v, list) and len(v) > 5 and v and isinstance(v[0], dict):
                        keys = list(v[0].keys())
                        if any(kk.lower() in ("name","title","sku","slug","handle","price") for kk in keys):
                            print(f"    {path}.{k} len={len(v)} keys={keys[:10]}")
                    if isinstance(v, (dict,list)):
                        walk(v, f"{path}.{k}")
        walk(data)
    except Exception as e:
        print(f"  parse err: {e}")

# Sample product
if links:
    first = list(links)[0]
    code, body = fetch(f"https://www.thorne.com{first}")
    txt = body.decode("utf-8","ignore")
    print(f"\n=== Thorne {first} status={code} len={len(body)} ===")
    found_ld = False
    for mm in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', txt, re.S):
        try:
            d = json.loads(mm.group(1).strip())
            cands = d if isinstance(d, list) else [d]
            for c in cands:
                if isinstance(c, dict) and c.get("@type") == "Product":
                    found_ld = True
                    print(f"  Product LD: name={c.get('name')!r} sku={c.get('sku')}")
                    o = c.get("offers")
                    if isinstance(o, dict): print(f"    price: {o.get('price')} {o.get('priceCurrency')}")
                    img = c.get("image"); n = len(img) if isinstance(img,list) else (1 if img else 0)
                    print(f"    images: {n}")
                    desc = c.get("description") or ""
                    print(f"    desc: {desc[:100]!r}")
        except: pass
    if not found_ld: print("  NO Product JSON-LD")

# NORDIC sample
print("\n=== Nordic product fetch ===")
# pick a real URL from sitemap
code, body = fetch("https://www.nordic.com/sitemap.xml")
txt = body.decode("utf-8","ignore")
prods = re.findall(r'<loc>(https://www\.nordic\.com/products/[^<]+)</loc>', txt)
print(f"  product locs from sitemap: {len(prods)}")
if prods:
    sample = prods[0]
    print(f"  sample: {sample}")
    code, body = fetch(sample)
    txt = body.decode("utf-8","ignore")
    print(f"  status={code} len={len(body)}")
    found_ld = False
    for mm in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', txt, re.S):
        try:
            d = json.loads(mm.group(1).strip())
            cands = d if isinstance(d, list) else [d]
            for c in cands:
                if isinstance(c, dict) and c.get("@type") == "Product":
                    found_ld = True
                    print(f"  Product LD: name={c.get('name')!r}")
                    o = c.get("offers")
                    if isinstance(o, dict): print(f"    price: {o.get('price')} {o.get('priceCurrency')}")
                    elif isinstance(o, list) and o: print(f"    offers list[0]: {o[0]}")
                    img = c.get("image"); n = len(img) if isinstance(img,list) else (1 if img else 0)
                    print(f"    images: {n}")
        except: pass
    if not found_ld: print("  NO Product JSON-LD; clues:")
    for k in ("shopify","cdn.shopify","__next_data","drupal","wp-content","oraclecommerce","occ-static","bigcommerce","commercecloud"):
        if k in txt.lower(): print(f"    clue: {k}")
