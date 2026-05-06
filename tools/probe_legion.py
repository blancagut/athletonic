import urllib.request, ssl, certifi, json
ctx = ssl.create_default_context(cafile=certifi.where())

# Try Cloudflare-style hardened request
HDR_FULL = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Referer": "https://legionathletics.com/",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
}

import gzip
def fetch(u):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=HDR_FULL), context=ctx, timeout=15)
        b = r.read()
        if r.headers.get("Content-Encoding")=="gzip":
            b = gzip.decompress(b)
        return r.status, b
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]
    except Exception as e:
        return None, str(e).encode()[:200]

# Try Legion
for u in ["https://legionathletics.com/products.json?limit=250&page=1",
          "https://legionathletics.com/sitemap.xml",
          "https://legionathletics.com/sitemap_products_1.xml",
          "https://legionathletics.com/collections/all/products.json?limit=250"]:
    s, b = fetch(u)
    print(f"  {s} len={len(b) if isinstance(b,bytes) else 0}  {u}")
    if isinstance(b, bytes) and s == 200 and len(b) > 100:
        try:
            d = json.loads(b)
            print(f"    products: {len(d.get('products',[]))}")
            if d.get('products'):
                print(f"    sample: {d['products'][0].get('title')} / vendor={d['products'][0].get('vendor')}")
        except:
            print(f"    head: {b[:150]!r}")

# Try myprotein UK/AU
for u in ["https://www.myprotein.com.au/products.json?limit=250",
          "https://www.myprotein.co.uk/products.json?limit=250",
          "https://www.myprotein.de/products.json?limit=250"]:
    s, b = fetch(u)
    print(f"  {s} len={len(b) if isinstance(b,bytes) else 0}  {u}")
