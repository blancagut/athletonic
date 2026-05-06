import gzip
import json
import ssl
import urllib.request
import zlib
from collections import Counter

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
BASE = "https://api.nike.com/product_feed/threads/v2/?filter=marketplace(US)&filter=language(en)&filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)&count=100"


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return json.loads(raw)


data = fetch(BASE)
objects = data.get("objects", [])
print("objects", len(objects), "pages", data.get("pages", {}))
print("top object keys", Counter(tuple(sorted(obj.keys())) for obj in objects).most_common(5))
with_info = [obj for obj in objects if obj.get("productInfo")]
print("with productInfo", len(with_info))
for obj in with_info[:3]:
    print("\nOBJECT", obj.get("id"), "keys", list(obj.keys()))
    info = obj.get("productInfo", [])
    print("productInfo len", len(info))
    print(json.dumps(info[0], indent=2)[:3000])

for obj in objects[:10]:
    pub = obj.get("publishedContent", {})
    print("summary", obj.get("id"), obj.get("productInfo") is not None, pub.get("properties", {}).get("title"), pub.get("type"))
