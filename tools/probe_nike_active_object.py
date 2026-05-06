import gzip
import json
import ssl
import urllib.parse
import urllib.request
import zlib

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nike.com",
    "Referer": "https://www.nike.com/",
}
params = [
    ("filter", "marketplace(US)"),
    ("filter", "language(en)"),
    ("filter", "channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)"),
    ("filter", "productInfo.merchProduct.status(ACTIVE)"),
    ("count", "1"),
]
url = "https://api.nike.com/product_feed/threads/v2/?" + urllib.parse.urlencode(params)
req = urllib.request.Request(url, headers=HEADERS)
with urllib.request.urlopen(req, timeout=25, context=CTX) as resp:
    raw = resp.read()
    enc = resp.headers.get("Content-Encoding")
    if enc == "gzip":
        raw = gzip.decompress(raw)
    elif enc == "deflate":
        raw = zlib.decompress(raw)
    data = json.loads(raw)
obj = data["objects"][0]
info = obj["productInfo"][0]
props = obj.get("publishedContent", {}).get("properties", {})
print("pages", data.get("pages"))
print("object_id", obj.get("id"))
print("published props")
print(json.dumps({k: props.get(k) for k in sorted(props.keys()) if k in {"title", "subtitle", "seo", "slug", "canonicalUrl", "url", "products", "description", "body", "squarishURL", "portraitURL"}}, indent=2)[:4000])
print("merchProduct")
mp = info.get("merchProduct", {})
print(json.dumps({k: mp.get(k) for k in ["id", "status", "styleCode", "colorCode", "styleColor", "pid", "labelName", "brand", "genders", "sportTags", "productType", "commerceStartDate", "fullTitle"]}, indent=2))
print("price")
print(json.dumps(info.get("merchPrice", {}), indent=2)[:1200])
print("sku keys")
skus = info.get("skus", [])
print(len(skus), json.dumps(skus[:2], indent=2)[:2000])
print("available skus")
av = info.get("availableSkus", [])
print(len(av), json.dumps(av[:2], indent=2)[:2000])
