import urllib.request, json, ssl, certifi, gzip, zlib, time

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

def probe(slug, url):
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw)
                if "products" in d:
                    print(f"{slug:30s} SHOPIFY  products={len(d['products'])} @ {r.geturl()}")
                elif isinstance(d, list):
                    print(f"{slug:30s} WOOCOMM  items={len(d)} @ {r.geturl()}")
                else:
                    print(f"{slug:30s} JSON-{r.status} keys={list(d.keys())[:5]} @ {r.geturl()}")
            except:
                preview = raw[:200].decode('utf-8','replace')
                print(f"{slug:30s} HTML-{r.status} ({len(raw)}b) preview={repr(preview[:80])}")
    except Exception as e:
        print(f"{slug:30s} ERR {type(e).__name__}: {str(e)[:70]}")
    time.sleep(0.5)

TESTS = [
    # Twins Special
    ("twins_shopify",      "https://twins-special.com/products.json?limit=5"),
    ("twins_woo_v3",       "https://twins-special.com/wp-json/wc/v3/products?per_page=5"),
    ("twins_woo_store",    "https://twins-special.com/wp-json/wc/store/v1/products?per_page=5"),
    ("twins_woo_v2",       "https://twins-special.com/wp-json/wc/v2/products?per_page=5"),
    ("twins_sitemap",      "https://twins-special.com/sitemap.xml"),
    ("twins_home",         "https://twins-special.com/"),
    # Raja Boxing 
    ("raja_woo_store",     "https://www.rajaboxing.com/wp-json/wc/store/v1/products?per_page=5"),
    ("raja_woo_v3",        "https://www.rajaboxing.com/wp-json/wc/v3/products?per_page=5"),
    ("raja_sitemap",       "https://www.rajaboxing.com/sitemap.xml"),
    # Windy alternatives
    ("windy_fight_home",   "https://windyfight.com/"),
    ("windy_thai_shop",    "https://shop.windyfight.com/"),
    ("windy_shopify",      "https://windyfight.com/products.json?limit=5"),
    ("windy_shopify2",     "https://shop.windyfight.com/products.json?limit=5"),
    # Yakkao alternatives
    ("yakkao_shopify",     "https://yakkaomuaythai.com/products.json?limit=5"),
    ("yakkao_shop2",       "https://shop.yakkaomuaythai.com/products.json?limit=5"),
    ("yakkao_woo",         "https://yakkaomuaythai.com/wp-json/wc/store/v1/products?per_page=5"),
    ("yakkao_home",        "https://yakkaomuaythai.com/"),
    # Thaismai alternatives
    ("thaismai_shopify",   "https://www.thaismai.com/products.json?limit=5"),
    ("thaismai_shop",      "https://shop.thaismai.com/products.json?limit=5"),
    ("thaismai_home",      "https://www.thaismai.com/"),
    ("thaismai_woo",       "https://www.thaismai.com/wp-json/wc/store/v1/products?per_page=5"),
]

for slug, url in TESTS:
    probe(slug, url)
