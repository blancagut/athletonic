"""Probe Shopify retailers for vendor coverage of premium brands."""
import urllib.request, ssl, certifi, json, sys

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {"User-Agent": "Mozilla/5.0 Chrome/124"}


def fetch_all(host, max_pages=80):
    vendors = {}
    total = 0
    for page in range(1, max_pages + 1):
        url = f"https://{host}/products.json?limit=250&page={page}"
        try:
            req = urllib.request.Request(url, headers=HDR)
            with urllib.request.urlopen(req, context=ctx, timeout=25) as r:
                d = json.loads(r.read())
        except Exception as e:
            print(f"  page {page} err: {e}", file=sys.stderr)
            break
        ps = d.get("products", [])
        if not ps:
            break
        for p in ps:
            v = (p.get("vendor") or "").strip()
            vendors[v] = vendors.get(v, 0) + 1
        total += len(ps)
        if len(ps) < 250:
            break
    return vendors, total


WANTED = [
    "garden of life", "thorne", "nordic naturals", "nutrilite",
    "now", "centrum", "pure encapsulations",
]

for host in ["www.swansonvitamins.com", "www.pipingrock.com"]:
    print(f"\n=== {host} ===")
    vendors, total = fetch_all(host)
    print(f"Total products: {total}, unique vendors: {len(vendors)}")
    print("\nBrand matches:")
    for w in WANTED:
        matches = {v: c for v, c in vendors.items() if w in v.lower()}
        if matches:
            for v, c in sorted(matches.items(), key=lambda x: -x[1]):
                print(f"  [{w:<22}] {v} -> {c}")
        else:
            print(f"  [{w:<22}] (none)")
    print("\nTop 20 vendors:")
    for v, c in sorted(vendors.items(), key=lambda x: -x[1])[:20]:
        print(f"  {v}: {c}")
