"""Probe blocked brands harder — alternative endpoints, sitemaps, regional sites."""
import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Ch-Ua": '"Chromium";v="127", "Not(A:Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
}

CANDIDATES = [
    # Kachava — ka'chava
    ("kachava_root",        "https://www.kachava.com/"),
    ("kachava_pj",          "https://www.kachava.com/products.json?limit=1"),
    ("kachava_alt",         "https://kachava.com/products.json?limit=1"),
    ("kachava_collections", "https://www.kachava.com/collections/all/products.json?limit=1"),
    # Huel
    ("huel_us_pj",          "https://huel.com/us/products.json?limit=1"),
    ("huel_pj",             "https://huel.com/products.json?limit=1"),
    ("huel_us_root",        "https://huel.com/us"),
    ("huel_uk_pj",          "https://uk.huel.com/products.json?limit=1"),
    ("huel_collections_us", "https://huel.com/collections/all/products.json?limit=1"),
    ("huel_collections_us2","https://huel.com/us/collections/all/products.json?limit=1"),
    # LMNT
    ("lmnt_root",           "https://drinklmnt.com/"),
    ("lmnt_pj",             "https://drinklmnt.com/products.json?limit=1"),
    ("lmnt_collections",    "https://drinklmnt.com/collections/all/products.json?limit=1"),
    ("lmnt_sitemap",        "https://drinklmnt.com/sitemap.xml"),
    # Hum Nutrition
    ("hum_pj",              "https://www.humnutrition.com/products.json?limit=1"),
    ("hum_alt",             "https://humnutrition.com/products.json?limit=1"),
    ("hum_collections",     "https://www.humnutrition.com/collections/all/products.json?limit=1"),
    # Truvani
    ("truvani_pj",          "https://www.truvani.com/products.json?limit=1"),
    ("truvani_alt",         "https://truvani.com/products.json?limit=1"),
    ("truvani_collections", "https://www.truvani.com/collections/all/products.json?limit=1"),
    # Sunwarrior
    ("sunwarrior_root",     "https://sunwarrior.com/"),
    ("sunwarrior_pj",       "https://sunwarrior.com/products.json?limit=1"),
    ("sunwarrior_www",      "https://www.sunwarrior.com/products.json?limit=1"),
    ("sunwarrior_coll",     "https://sunwarrior.com/collections/all/products.json?limit=1"),
    # BiOptimizers
    ("bioptim_pj",          "https://bioptimizers.com/products.json?limit=1"),
    ("bioptim_shop",        "https://shop.bioptimizers.com/products.json?limit=1"),
    ("bioptim_root",        "https://bioptimizers.com/"),
    # Seed
    ("seed_pj",             "https://seed.com/products.json?limit=1"),
    ("seed_root",           "https://seed.com/"),
]

for name, url in CANDIDATES:
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw)
                print(f"{name:25s} {r.status} JSON products={len(d.get('products',[]))}")
            except:
                head = raw[:8000].decode("utf-8", errors="replace").lower()
                hint = []
                if "shopify" in head: hint.append("shopify")
                if "magento" in head: hint.append("magento")
                if "bigcommerce" in head: hint.append("bigcommerce")
                if "woocommerce" in head: hint.append("woocommerce")
                if "next.js" in head or "_next" in head: hint.append("nextjs")
                print(f"{name:25s} {r.status} HTML hints={hint or ['?']} len={len(raw)}")
    except Exception as e:
        print(f"{name:25s} ERR {type(e).__name__}: {str(e)[:80]}")
