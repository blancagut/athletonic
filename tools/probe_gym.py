"""Probe gym accessory brands for Shopify /products.json availability."""
import urllib.request, json, ssl, certifi

BRANDS = {
    "gymshark":          "https://www.gymshark.com",
    "rogue_fitness":     "https://www.roguefitness.com",
    "harbinger":         "https://www.harbingerfitness.com",
    "schiek":            "https://www.schiek.com",
    "bear_komplex":      "https://www.bearkomplex.com",
    "dark_iron_fitness": "https://darkironfitness.com",
    "rdx_sports":        "https://rdxsports.com",
    "iron_bull_strength":"https://ironbullstrength.com",
    "trx":               "https://www.trxtraining.com",
    "theraband":         "https://www.theraband.com",
}

ctx = ssl.create_default_context(cafile=certifi.where())
hdr = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

for slug, base in BRANDS.items():
    url = base.rstrip("/") + "/products.json?limit=1"
    try:
        req = urllib.request.Request(url, headers=hdr)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                import gzip; raw = gzip.decompress(raw)
            elif r.headers.get("Content-Encoding") == "deflate":
                import zlib; raw = zlib.decompress(raw)
            try:
                d = json.loads(raw)
                n = len(d.get("products", []))
                print(f"{slug:25s} {r.status} shopify=YES sample_products={n}")
            except Exception:
                print(f"{slug:25s} {r.status} shopify=NO (not JSON, len={len(raw)})")
    except Exception as e:
        print(f"{slug:25s} ERR {type(e).__name__}: {e}")
