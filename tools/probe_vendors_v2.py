import urllib.request, ssl, certifi, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 Chrome/124"}

hosts = [
    "https://www.bodybuilding.com",
    "https://supplementsource.ca",
    "https://supplementmart.com.au",
    "https://www.discount-supplements.co.uk",
    "https://www.thefeed.com",
]

needles = ["legion","myprotein","my protein","bsn","dymatize","optimum","muscletech","cellucor","gorilla mind","raw nutrition","transparent labs","ghost","kaged","alpha lion","ryse","redcon","jacked factory","pescience","huge supplement","five percent","axe sledge","musclepharm","onnit"]

for host in hosts:
    print(f"\n=== {host} ===")
    vendors = {}
    total = 0
    for p in range(1, 80):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f"{host}/products.json?limit=250&page={p}", headers=HDR), context=ctx, timeout=20)
            d = json.loads(r.read())
            ps = d.get("products",[])
            if not ps: break
            for prod in ps:
                v = (prod.get("vendor") or "").strip()
                vendors[v] = vendors.get(v,0)+1
            total += len(ps)
            if len(ps) < 250: break
        except Exception as e:
            print(f"  err p{p}: {e}"); break
    print(f"  total={total} vendors={len(vendors)}")
    for n in needles:
        m = {v:c for v,c in vendors.items() if n in v.lower()}
        for v,c in sorted(m.items(),key=lambda x:-x[1]):
            print(f"  [{n:<18}] {v} -> {c}")
