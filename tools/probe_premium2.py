import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Chromium";v="127", "Not(A:Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
}

for url in [
    "https://www.buckedup.com/products.json?limit=1",
    "https://www.buckedup.com/collections/all/products.json?limit=1",
    "https://shop.buckedup.com/products.json?limit=1",
    "https://buckedup.myshopify.com/products.json?limit=1",
    # JYM
    "https://www.jymsupplementscience.com/products.json?limit=1",
    # Beyond Raw - check sitemap
    "https://www.beyondraw.com/sitemap.xml",
]:
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw); print(f"{url:80s} {r.status} JSON products={len(d.get('products',[]))}")
            except:
                head = raw[:300].decode("utf-8", errors="replace")
                print(f"{url:80s} {r.status} {len(raw)}b head={head[:120]!r}")
    except Exception as e:
        print(f"{url:80s} ERR {type(e).__name__}: {str(e)[:90]}")
