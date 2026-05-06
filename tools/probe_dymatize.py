import urllib.request, ssl, certifi, re, gzip
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 Chrome/124","Accept":"*/*"}

def fetch(u):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=HDR), context=ctx, timeout=15)
        b = r.read()
        if u.endswith(".gz"):
            try: b = gzip.decompress(b)
            except: pass
        return r.status, b
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:300]
    except Exception as e:
        return None, str(e)[:120].encode()

# Dymatize sitemap inspection
print("=== dymatize sitemap.xml ===")
s,b = fetch("https://www.dymatize.com/sitemap.xml")
print(b.decode(errors='ignore')[:2000])
