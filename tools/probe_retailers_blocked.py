"""Check retailers for Sunwarrior, Hum, Huel, LMNT, BiOptimizers, Seed."""
import urllib.request, json, ssl, certifi, gzip, zlib
from collections import Counter

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip, deflate"}

RETAILERS = {
    "swanson":     "https://www.swansonvitamins.com",
    "the_feed":    "https://www.thefeed.com",
    "tiger":       "https://www.tigerfitness.com",
    "supp_warehouse": "https://www.supplementwarehouse.com",
    "supp_hunt":   "https://supplementhunt.com",
    "suppz":       "https://www.suppz.com",
    "bb_com":      "https://www.bodybuilding.com",
    "supp_mart_au":"https://supplementmart.com.au",
    "supp_src_ca": "https://supplementsource.ca",
    "ds_uk":       "https://www.discount-supplements.co.uk",
}

NEEDLES = ["sunwarrior", "hum nutrition", "huel", "lmnt", "bioptimizers", "seed", "kachava", "truvani"]

def get_all(base):
    all_p = []
    for page in range(1, 30):
        url = f"{base}/products.json?limit=250&page={page}"
        try:
            req = urllib.request.Request(url, headers=HDR)
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                raw = r.read()
                enc = r.headers.get("Content-Encoding")
                if enc == "gzip": raw = gzip.decompress(raw)
                elif enc == "deflate": raw = zlib.decompress(raw)
                d = json.loads(raw); ps = d.get("products", [])
                if not ps: break
                all_p.extend(ps)
                if len(ps) < 250: break
        except Exception: break
    return all_p

for slug, base in RETAILERS.items():
    ps = get_all(base)
    counts = Counter()
    for p in ps:
        v = (p.get("vendor") or "").strip().lower()
        nm = (p.get("title") or "").lower()
        for n in NEEDLES:
            if n in v or n in nm:
                counts[(n, p.get("vendor", "?"))] += 1
    if counts:
        print(f"\n=== {slug} ({len(ps)}) ===")
        for (n, v), c in counts.most_common():
            print(f"  {n:14s} vendor={v[:40]!r:42s} {c}")
