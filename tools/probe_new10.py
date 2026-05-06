"""Probe 15+ NEW high-priority brands not currently in catalog."""
import urllib.request, json, ssl, certifi, gzip, zlib

ctx = ssl.create_default_context(cafile=certifi.where())
HDR = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

CANDIDATES = {
    # Meal replacement / functional drinks
    "kachava":               "https://www.kachava.com",
    "huel":                  "https://huel.com/us",
    "huel_root":             "https://huel.com",
    # Electrolytes
    "lmnt":                  "https://drinklmnt.com",
    "cure_hydration":        "https://www.curehydration.com",
    # Wellness gummies / women's
    "goli":                  "https://goli.com",
    "hum_nutrition":         "https://www.humnutrition.com",
    # DTC supplement brands
    "inno_supps":            "https://innosupps.com",
    "bowmar":                "https://bowmarnutrition.com",
    "glaxon":                "https://www.glaxon.com",
    "truvani":               "https://www.truvani.com",
    "sunwarrior":            "https://sunwarrior.com",
    "jocko_fuel":            "https://jockofuel.com",
    "bioptimizers":          "https://bioptimizers.com",
    "codeage":               "https://www.codeage.com",
    # Premium pre-workouts
    "black_magic":           "https://blackmagicsupps.com",
    "core_nutritionals":     "https://corenutritionals.com",
    "inspired":              "https://inspirednutra.com",
    "ehp_labs":              "https://ehplabs.com",
    "mts_nutrition":         "https://www.tigerfitness.com",  # MTS lives at tigerfitness/MTS — skip
    # Protein bar / nutrition
    "quest":                 "https://www.questnutrition.com",
    "rule1":                 "https://rule1.com",
    "grenade":               "https://www.grenade.com",
    "bpi_sports":            "https://bpisports.com",
    "nutrex":                "https://nutrex.com",
    # Probiotics / longevity
    "seed":                  "https://seed.com",
    "just_thrive":           "https://justthrivehealth.com",
    "hvmn":                  "https://hvmn.com",
}

for slug, base in CANDIDATES.items():
    url = base.rstrip("/") + "/products.json?limit=1"
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding")
            if enc == "gzip": raw = gzip.decompress(raw)
            elif enc == "deflate": raw = zlib.decompress(raw)
            try:
                d = json.loads(raw)
                # also check products.json?limit=250&page=1 to estimate size
                url2 = base.rstrip("/") + "/products.json?limit=250"
                req2 = urllib.request.Request(url2, headers=HDR)
                with urllib.request.urlopen(req2, timeout=15, context=ctx) as r2:
                    raw2 = r2.read()
                    enc2 = r2.headers.get("Content-Encoding")
                    if enc2 == "gzip": raw2 = gzip.decompress(raw2)
                    elif enc2 == "deflate": raw2 = zlib.decompress(raw2)
                    d2 = json.loads(raw2)
                    print(f"{slug:22s} OK products(p1)={len(d2.get('products',[]))}")
            except Exception as e:
                print(f"{slug:22s} {r.status} not-json ({len(raw)}b)")
    except Exception as e:
        msg = str(e)[:80]
        print(f"{slug:22s} ERR {type(e).__name__}: {msg}")
