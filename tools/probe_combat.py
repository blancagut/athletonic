"""Probe combat sports + athletic apparel brands."""
import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

CANDIDATES = {
    "venum":           "https://www.venum.com",
    "venum_us":        "https://us.venum.com",
    "hayabusa":        "https://www.hayabusafight.com",
    "hayabusa_alt":    "https://hayabusafight.com",
    "fairtex":         "https://www.fairtex.com",
    "fairtex_alt":     "https://fairtex.com",
    "fairtex_store":   "https://store.fairtex.com",
    "sanabul":         "https://sanabulsports.com",
    "sanabul_alt":     "https://www.sanabulsports.com",
    # rdx_sports already in catalog (verified)
    "century_ma":      "https://www.centurymartialarts.com",
    "century_ma_alt":  "https://centurymartialarts.com",
    "fuji_sports":     "https://fujisports.com",
    "fuji_alt":        "https://www.fujisports.com",
    "revgear":         "https://www.revgear.com",
    "revgear_alt":     "https://revgear.com",
    "twins_special":   "https://www.twins-special.com",
    "twins_alt":       "https://twins-special.com",
    "twins_us":        "https://twinsspecialusa.com",
    "everlast":        "https://www.everlast.com",
    "everlast_alt":    "https://everlast.com",
    # Athletic apparel/sneakers — these are very heavily protected typically
    "nike":            "https://www.nike.com",
    "adidas":          "https://www.adidas.com",
    "puma":            "https://us.puma.com",
    # "Hooka" — likely typo for Hoka (running shoes)
    "hoka":            "https://www.hoka.com",
    "hoka_alt":        "https://hoka.com",
}

for slug, base in CANDIDATES.items():
    url = base.rstrip("/") + "/products.json?limit=250"
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw)
                print(f"{slug:18s} OK products(p1)={len(d.get('products',[]))}")
            except:
                print(f"{slug:18s} {r.status} not-json ({len(raw)}b)")
    except Exception as e:
        print(f"{slug:18s} ERR {type(e).__name__}: {str(e)[:70]}")
