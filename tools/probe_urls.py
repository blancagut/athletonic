import urllib.request, ssl, certifi, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 Chrome/124"}

candidates = {
    "raw_nutrition": ["https://rawnutritionofficial.com","https://www.getrawnutrition.com","https://getrawnutrition.com","https://rawnutrition.com"],
    "dymatize": ["https://www.dymatize.com","https://dymatize.com","https://us.dymatize.com"],
    "bsn": ["https://www.bsnsupplements.com","https://bsnsupplements.com","https://www.bsn.com"],
    "myprotein": ["https://us.myprotein.com","https://www.myprotein.com","https://www.myprotein.us"],
    "legion_athletics": ["https://legionathletics.com","https://www.legionathletics.com"],
    "muscletech": ["https://www.muscletech.com","https://muscletech.com","https://us.muscletech.com"],
    "cellucor": ["https://cellucor.com","https://www.cellucor.com"],
    "gorilla_mind": ["https://gorillamind.com","https://www.gorillamind.com"],
}

def try_pj(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(f"{url}/products.json?limit=1", headers=HDR), context=ctx, timeout=10)
        d = json.loads(r.read())
        return r.status, len(d.get("products",[]))
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return None, str(e)[:60]

for slug, urls in candidates.items():
    print(f"\n{slug}:")
    for u in urls:
        s, n = try_pj(u)
        print(f"  {s} {n if n is not None else ''}  {u}")
