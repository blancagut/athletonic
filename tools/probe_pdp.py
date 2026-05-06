"""Probe a few PDPs to confirm JSON-LD / og:description availability."""
import urllib.request, ssl, certifi, sqlite3, re, json, sys
ctx = ssl.create_default_context(cafile=certifi.where())
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        return r.read().decode("utf-8", errors="ignore")

c = sqlite3.connect("output/data/products.db")

probes = [
    ("compex",          "description_html IS NULL OR description_html=''"),
    ("body_science_au", "description_html IS NULL OR description_html=''"),
    ("ghost_lifestyle", "description_html IS NULL OR description_html=''"),
    ("alpha_lion",      "description_html IS NULL OR description_html=''"),
    ("liquid_iv",       "description_html IS NULL OR description_html=''"),
    ("optimum_nutrition", "price IS NULL"),
    ("ghost_lifestyle", "id NOT IN (SELECT product_row_id FROM images)"),
]

LD_RE = re.compile(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.DOTALL)
OG_RE = re.compile(r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)', re.I)
MD_RE = re.compile(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', re.I)

for brand, where in probes:
    row = c.execute(f"SELECT url FROM products WHERE brand=? AND ({where}) LIMIT 1", (brand,)).fetchone()
    if not row:
        print(f"== {brand} ({where}): no rows")
        continue
    url = row[0]
    print(f"\n== {brand} :: {url}")
    try:
        html = fetch(url)
    except Exception as e:
        print(f"   FETCH ERR: {e}")
        continue
    blocks = LD_RE.findall(html)
    found_product = False
    for b in blocks:
        try:
            d = json.loads(b)
        except Exception:
            continue
        for item in (d if isinstance(d, list) else [d]):
            if isinstance(item, dict) and item.get("@type") in ("Product", ["Product"]):
                found_product = True
                offers = item.get("offers")
                price = None
                if isinstance(offers, dict):
                    price = offers.get("price") or offers.get("lowPrice")
                elif isinstance(offers, list) and offers:
                    price = offers[0].get("price")
                imgs = item.get("image")
                img_n = len(imgs) if isinstance(imgs, list) else (1 if imgs else 0)
                desc = item.get("description") or ""
                print(f"   JSON-LD Product: desc={len(desc)}c price={price} images={img_n}")
                break
        if found_product:
            break
    if not found_product:
        print("   JSON-LD Product: MISSING")
    og = OG_RE.search(html)
    md = MD_RE.search(html)
    print(f"   og:description: {len(og.group(1)) if og else 0}c")
    print(f"   meta description: {len(md.group(1)) if md else 0}c")
