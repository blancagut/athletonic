import urllib.request, ssl, certifi, re, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 Chrome/124"}

def fetch(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=HDR), context=ctx, timeout=15)
    return r.read().decode(errors='ignore')

# 1. Get product URLs from dymatize sitemap
print("=== dymatize products sitemap ===")
b = fetch("https://dymatize.com/sitemaps-1-section-products-1-sitemap.xml")
locs = re.findall(r'<loc>([^<]+)</loc>', b)
print(f"product urls: {len(locs)}")
print(f"sample: {locs[:5]}")
print(f"last: {locs[-3:]}")

# 2. Sample one PDP for parseable data
if locs:
    print("\n=== sample PDP ===")
    pdp = fetch(locs[0])
    print(f"len={len(pdp)}")
    # JSON-LD
    for m in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.+?)</script>', pdp, re.DOTALL):
        try:
            j = json.loads(m)
            if isinstance(j, dict) and "Product" in str(j.get("@type","")):
                print("JSON-LD Product:")
                print(f"  name: {j.get('name')}")
                print(f"  desc: {(j.get('description') or '')[:120]}")
                offers = j.get('offers', {})
                if isinstance(offers, list): offers = offers[0] if offers else {}
                print(f"  price: {offers.get('price') if isinstance(offers,dict) else None}")
                imgs = j.get('image', [])
                imgs = imgs if isinstance(imgs, list) else [imgs]
                print(f"  images: {len(imgs)}")
                break
            elif isinstance(j, list):
                for jj in j:
                    if isinstance(jj, dict) and "Product" in str(jj.get("@type","")):
                        print("JSON-LD Product (in list):")
                        print(f"  name: {jj.get('name')}")
                        break
        except: pass
    # title fallback
    m = re.search(r'<title>([^<]+)', pdp)
    print(f"\n<title>: {m.group(1) if m else None}")
