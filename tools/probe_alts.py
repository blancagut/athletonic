import urllib.request, ssl, certifi, json, re, gzip
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
     "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
     "Accept-Language":"en-US,en;q=0.5"}

def fetch(u, timeout=15):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=HDR), context=ctx, timeout=timeout)
        b = r.read()
        if u.endswith(".gz") or r.headers.get("Content-Encoding")=="gzip":
            try: b = gzip.decompress(b)
            except: pass
        return r.status, b
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]
    except Exception as e:
        return None, str(e)[:120].encode()

# myprotein
print("=== myprotein ===")
for u in ["https://us.myprotein.com/sitemap.xml",
          "https://us.myprotein.com/sitemap_index.xml",
          "https://us.myprotein.com/sitemap-product.xml",
          "https://www.myprotein.com/sitemap.xml",
          "https://us.myprotein.com/sports-nutrition.list",
          "https://us.myprotein.com/api/products"]:
    s,b = fetch(u)
    print(f"  {s} len={len(b) if isinstance(b,bytes) else 0}  {u}")
    if isinstance(b,bytes) and s==200 and b[:5]==b'<?xml':
        # sitemap content
        sub = re.findall(r'<loc>([^<]+)</loc>', b.decode(errors='ignore'))
        print(f"    sitemaps inside: {len(sub)}, sample: {sub[:3]}")

# legion
print("\n=== legion_athletics ===")
for u in ["https://legionathletics.com/sitemap.xml",
          "https://legionathletics.com/sitemap_products_1.xml",
          "https://legionathletics.com/products.json"]:
    s,b = fetch(u)
    print(f"  {s} len={len(b) if isinstance(b,bytes) else 0}  {u}")

# dymatize
print("\n=== dymatize ===")
for u in ["https://www.dymatize.com/sitemap.xml",
          "https://www.dymatize.com/en-us/sitemap.xml",
          "https://www.dymatize.com/en-us/products.json",
          "https://shop.dymatize.com/products.json",
          "https://shop.dymatize.com/sitemap.xml",
          "https://www.dymatize.com/products"]:
    s,b = fetch(u)
    print(f"  {s} len={len(b) if isinstance(b,bytes) else 0}  {u}")

# bsn
print("\n=== bsn ===")
for u in ["https://www.bsnsupplements.com/sitemap.xml",
          "https://bsn.com/sitemap.xml",
          "https://www.bsn.com/sitemap.xml",
          "https://shop.bsn.com/products.json",
          "https://www.glanbianutritionals.com/bsn",
          "https://us.bsn.com/sitemap.xml"]:
    s,b = fetch(u)
    print(f"  {s} len={len(b) if isinstance(b,bytes) else 0}  {u}")
