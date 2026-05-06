import socket; socket.setdefaulttimeout(8)
import urllib.request, ssl, certifi, json, re
ctx = ssl.create_default_context(cafile=certifi.where())
HDRS = {"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"}

targets = {
    "garden_of_life":      "https://www.gardenoflife.com",
    "thorne":              "https://www.thorne.com",
    "nordic_naturals":     "https://www.nordic.com",
    "nutrilite":           "https://www.amway.com",
    "now_foods":           "https://www.nowfoods.com",
    "centrum":             "https://www.centrum.com",
    "pure_encapsulations": "https://www.pureencapsulations.com",
}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=HDRS)
        with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
            return r.status, r.read(60000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return f"ERR:{type(e).__name__}", b""

for name, base in targets.items():
    print(f"\n=== {name} {base} ===")
    code, body = fetch(f"{base}/products.json?limit=1")
    ok = False
    try:
        d = json.loads(body); n = len(d.get("products", [])); print(f"  shopify products.json: {code} n={n}"); ok = True
    except Exception:
        print(f"  shopify products.json: {code} (not json)")
    if ok:
        continue
    code, body = fetch(f"{base}/sitemap.xml")
    print(f"  sitemap.xml: {code} len={len(body)}")
    if body:
        urls = re.findall(rb"<loc>([^<]+)</loc>", body)[:5]
        for u in urls: print(f"    {u.decode()}")
    code, body = fetch(base)
    txt = body.decode("utf-8","ignore").lower() if body else ""
    plat = []
    for k in ("shopify","magento","bigcommerce","drupal","sfra","sfcc","commercecloud","wordpress","wp-content","woocommerce","salesforce","hybris","next-data","__next_data","cdn.shopify","occ.commercecloud","oraclecloud"):
        if k in txt: plat.append(k)
    print(f"  homepage status={code} clues={plat}")
