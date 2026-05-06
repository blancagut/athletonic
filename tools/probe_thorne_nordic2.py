import socket; socket.setdefaulttimeout(10)
import urllib.request, ssl, certifi, re, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDRS = {"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"}

def fetch(url, hdrs=HDRS):
    try:
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return f"ERR:{type(e).__name__}", b""

# THORNE: /products page — examine structure more carefully
code, body = fetch("https://www.thorne.com/products")
txt = body.decode("utf-8","ignore")
print(f"Thorne /products: {code} len={len(body)}")
# Search for /products/something pattern, broad
m = re.findall(r'/products/[a-z0-9][a-z0-9\-]+', txt)
uniq = sorted(set(m))
print(f"  unique /products/ refs: {len(uniq)}")
for x in uniq[:10]: print(f"    {x}")

# Check for next data
nm = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', txt, re.S)
print(f"  __NEXT_DATA__: {bool(nm)}")
if nm:
    raw = nm.group(1)
    print(f"  data len={len(raw)}")
    # write sample for inspection
    with open("/tmp/thorne_next.json","w") as f: f.write(raw)
    try:
        data = json.loads(raw)
        # find dict keys recursively that contain "products" or similar lists
        def find_lists(o, path=""):
            if isinstance(o, dict):
                for k,v in o.items():
                    if isinstance(v, list) and len(v) >= 5 and isinstance(v[0], dict):
                        keys = set()
                        for it in v[:3]:
                            keys.update(it.keys() if isinstance(it,dict) else [])
                        product_like = {"name","title","sku","slug","price","handle","url"}
                        if keys & product_like:
                            print(f"  CANDIDATE {path}.{k}  count={len(v)}  keys={sorted(keys)[:14]}")
                    if isinstance(v,(dict,list)): find_lists(v, f"{path}.{k}")
            elif isinstance(o, list):
                for i,v in enumerate(o[:3]):
                    if isinstance(v,(dict,list)): find_lists(v, f"{path}[{i}]")
        find_lists(data)
    except Exception as e:
        print(f"  parse: {e}")

# NORDIC -- try Hydrogen GraphQL
print("\n=== Nordic Hydrogen probe ===")
# try /api/2024-01/graphql.json (typical Hydrogen)
gql_q = b'{"query":"{ products(first:5) { edges { node { id title handle } } } }"}'
for path in ["/api/2024-01/graphql.json", "/api/2023-10/graphql.json", "/api/2024-04/graphql.json"]:
    try:
        req = urllib.request.Request(f"https://www.nordic.com{path}", data=gql_q,
            headers={**HDRS, "Content-Type":"application/json"})
        with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
            print(f"  {path}: {r.status} body[:200]={r.read(200)!r}")
    except urllib.error.HTTPError as e:
        print(f"  {path}: HTTP {e.code}")
    except Exception as e:
        print(f"  {path}: ERR {type(e).__name__}")

# Nordic — use product page with deeper JSON-LD detection (might be inline JSON not script tag)
code, body = fetch("https://www.nordic.com/products/zero-sugar-vitamin-b12-gummies/")
txt = body.decode("utf-8","ignore")
# Look for Shopify product json embedded
for pat in [r'"@type":"Product"', r'window\.ShopifyAnalytics\s*=\s*window\.ShopifyAnalytics', r'shopifyMeta', r'__NEXT_DATA__', r'"productType"', r'window\.__INITIAL_STATE__']:
    if re.search(pat, txt): print(f"  Nordic page has: {pat}")

# Try shopify analytics tracking which has product data
m = re.search(r'var meta\s*=\s*({.*?});', txt, re.S)
if m:
    print(f"  var meta found, len={len(m.group(1))}")
    snip = m.group(1)[:500]
    print(f"  meta snippet: {snip}")

# extract og:price etc
og = re.findall(r'<meta[^>]+(?:property|name)="(og:[^"]+|product:[^"]+)"[^>]+content="([^"]+)"', txt)
print(f"  og/product meta tags: {len(og)}")
for k,v in og[:8]: print(f"    {k} = {v[:100]}")
