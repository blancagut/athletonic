import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

CANDIDATES = {
    "fairtex":          "https://www.fairtex.com",
    "windy_fight":      "https://www.windyfight.com",
    "windy_boxing":     "https://www.windy-boxing.com",
    "windy_us":         "https://windyusa.com",
    "twins_special":    "https://www.twins-special.com",
    "twins_special_alt":"https://twins-special.com",
    "twins_usa":        "https://twinsspecialusa.com",
    "raja_boxing":      "https://www.rajaboxing.com",
    "raja_thai":        "https://www.rajathaiboxing.com",
    "thaismai":         "https://www.thaismai.com",
    "thaismai_alt":     "https://thaismai.com",
    "yakkao":           "https://www.yakkaomuaythai.com",
    "yakkao_alt":       "https://yakkao.com",
    "yakkao_muaythai":  "https://www.yakkao.com",
}

for slug, base in CANDIDATES.items():
    # Try /products.json
    url = base.rstrip("/") + "/products.json?limit=5"
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw)
                count = len(d.get("products", []))
                print(f"{slug:22s} SHOPIFY  {r.geturl()} products_p1={count}")
            except:
                print(f"{slug:22s} HTTP-{r.status} (not JSON, {len(raw)}b) @ {r.geturl()}")
    except Exception as e:
        print(f"{slug:22s} ERR {type(e).__name__}: {str(e)[:80]}")
