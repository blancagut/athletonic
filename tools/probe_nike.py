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
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nike.com",
    "Referer": "https://www.nike.com/",
}

URLS = {
    "browse_all": "https://api.nike.com/cic/browse/v2?queryid=products&anonymousId=00000000-0000-0000-0000-000000000000&country=us&language=en&localizedRangeStr=%7BlowestPrice%7D%20%E2%80%94%20%7BhighestPrice%7D&path=/w",
    "browse_mens_running": "https://api.nike.com/cic/browse/v2?queryid=products&anonymousId=00000000-0000-0000-0000-000000000000&country=us&language=en&localizedRangeStr=%7BlowestPrice%7D%20%E2%80%94%20%7BhighestPrice%7D&path=/w/mens-running-shoes-37v7jznik1zy7ok",
    "feed": "https://api.nike.com/product_feed/threads/v2/?filter=marketplace(US)&filter=language(en)&filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)&count=24",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return resp.status, raw


for name, url in URLS.items():
    try:
        status, raw = fetch(url)
        text = raw.decode("utf-8", errors="replace")
        data = json.loads(text)
        print(f"\n{name} status={status} keys={list(data)[:10]} len={len(text)}")
        print(json.dumps(data, indent=2)[:2500])
    except Exception as exc:
        print(f"\n{name} ERR {type(exc).__name__}: {str(exc)[:140]}")
