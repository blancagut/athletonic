"""Check which retailers carry Bucked Up, Beyond Raw, JYM, Animal, Universal."""
import urllib.request, json, ssl, certifi, gzip, zlib
from collections import Counter

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept-Encoding": "gzip, deflate",
}

RETAILERS = {
    "tiger_fitness":          "https://www.tigerfitness.com",
    "supplement_warehouse":   "https://www.supplementwarehouse.com",
    "supplement_hunt":        "https://supplementhunt.com",
    "suppz":                  "https://www.suppz.com",
    "swanson":                "https://www.swansonvitamins.com",
    "the_feed":               "https://www.thefeed.com",
    "bodybuilding_com":       "https://www.bodybuilding.com",
    "supplement_mart_au":     "https://supplementmart.com.au",
    "supplement_source_ca":   "https://supplementsource.ca",
    "discount_supplements_uk":"https://www.discount-supplements.co.uk",
}

NEEDLES = ["bucked", "beyond raw", "jym", "animal", "universal"]

def get_all(base):
    all_p = []
    for page in range(1, 25):
        url = f"{base}/products.json?limit=250&page={page}"
        try:
            req = urllib.request.Request(url, headers=HDR)
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                raw = r.read()
                enc = r.headers.get("Content-Encoding")
                if enc == "gzip": raw = gzip.decompress(raw)
                elif enc == "deflate": raw = zlib.decompress(raw)
                d = json.loads(raw)
                ps = d.get("products", [])
                if not ps: break
                all_p.extend(ps)
                if len(ps) < 250: break
        except Exception as e:
            print(f"  ! page {page}: {e}"); break
    return all_p

for slug, base in RETAILERS.items():
    try:
        ps = get_all(base)
    except Exception as e:
        print(f"{slug}: ERR {e}"); continue
    counts = Counter()
    for p in ps:
        v = (p.get("vendor") or "").strip()
        nm = (p.get("title") or "").lower()
        for n in NEEDLES:
            if n in v.lower() or n in nm:
                counts[(n, v)] += 1
    if counts:
        print(f"\n=== {slug} ({len(ps)} products) ===")
        for (n, v), c in sorted(counts.items(), key=lambda x: -x[1])[:20]:
            print(f"  {n:12s} vendor={v!r:40s} {c}")
    else:
        print(f"{slug}: no matches ({len(ps)} prods)")
