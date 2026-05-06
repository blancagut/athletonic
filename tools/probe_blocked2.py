"""Round 2 probes — explore Shopify hidden endpoints."""
import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept-Encoding": "gzip, deflate",
    "Accept": "*/*",
}

def get(url):
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        raw = r.read()
        enc = r.headers.get("Content-Encoding")
        if enc == "gzip": raw = gzip.decompress(raw)
        elif enc == "deflate": raw = zlib.decompress(raw)
        return r.status, raw

URLS = [
    # LMNT — confirmed Shopify, try sitemap_products
    "https://drinklmnt.com/sitemap_products_1.xml",
    "https://drinklmnt.com/sitemap_products_1.xml?from=1&to=999",
    "https://drinklmnt.com/sitemap_index.xml",
    # Huel — try alternate Shopify routes
    "https://huel.com/sitemap.xml",
    "https://huel.com/us/sitemap_products_1.xml",
    "https://huel.com/sitemap_products_1.xml",
    "https://huel.com/products.json",
    # Hum
    "https://www.humnutrition.com/sitemap.xml",
    "https://www.humnutrition.com/",
    # Truvani
    "https://www.truvani.com/sitemap.xml",
    "https://www.truvani.com/",
    # BiOptimizers — check what platform
    "https://bioptimizers.com/sitemap.xml",
    "https://bioptimizers.com/wp-json/wc/store/products?per_page=1",
    "https://bioptimizers.com/wp-json/wp/v2/product?per_page=1",
    # Sunwarrior
    "https://sunwarrior.com/sitemap.xml",
]

for url in URLS:
    try:
        s, raw = get(url)
        try:
            d = json.loads(raw)
            n = len(d) if isinstance(d, list) else len(d.get("products", []))
            print(f"{url[:75]:75s} {s} JSON n={n}")
        except:
            head = raw[:5000].decode("utf-8", errors="replace").lower()
            hint = []
            if "shopify" in head: hint.append("shopify")
            if "magento" in head: hint.append("magento")
            if "wp-content" in head or "wordpress" in head: hint.append("wp")
            if "<urlset" in head or "<sitemapindex" in head: hint.append("sitemap-xml")
            if "<loc>" in head:
                # count product URLs
                cnt = head.count("/products/")
                if cnt > 0: hint.append(f"products={cnt}")
            print(f"{url[:75]:75s} {s} hints={hint} len={len(raw)}")
    except Exception as e:
        print(f"{url[:75]:75s} ERR {type(e).__name__}: {str(e)[:60]}")
