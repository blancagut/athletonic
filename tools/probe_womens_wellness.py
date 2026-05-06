import gzip
import json
import re
import ssl
import urllib.request
import zlib

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}

BRANDS = {
    "agent_nateur": ["https://www.agentnateur.com", "https://agentnateur.com"],
    "moon_juice": ["https://moonjuice.com", "https://www.moonjuice.com"],
    "the_nue_co": ["https://www.thenueco.com", "https://thenueco.com"],
    "jshealth_vitamins": ["https://us.jshealthvitamins.com", "https://jshealthvitamins.com"],
    "needed": ["https://thisisneeded.com", "https://www.thisisneeded.com"],
    "perelel": ["https://perelelhealth.com", "https://www.perelelhealth.com"],
    "rae_wellness": ["https://raewellness.co", "https://www.raewellness.co"],
    "love_wellness": ["https://lovewellness.com", "https://www.lovewellness.com"],
    "o_positiv": ["https://opositiv.com", "https://www.opositiv.com"],
    "winged_wellness": ["https://wingedwellness.com", "https://www.wingedwellness.com"],
    "arrae": ["https://www.arrae.com", "https://arrae.com"],
    "welleco": ["https://www.welleco.com", "https://welleco.com"],
    "dose_and_co": ["https://doseandco.com", "https://www.doseandco.com"],
    "ancient_nutrition": ["https://ancientnutrition.com", "https://www.ancientnutrition.com"],
    "sports_research": ["https://sportsresearch.com", "https://www.sportsresearch.com"],
    "further_food": ["https://www.furtherfood.com", "https://furtherfood.com"],
    "beekeepers_naturals": ["https://www.beekeepersnaturals.com", "https://beekeepersnaturals.com"],
    "nutrafol": ["https://nutrafol.com", "https://www.nutrafol.com"],
    "armra": ["https://tryarmra.com", "https://www.tryarmra.com"],
    "anima_mundi": ["https://animamundiherbals.com", "https://www.animamundiherbals.com"],
}

HINTS = [
    "shopify",
    "cdn.shopify.com",
    "woocommerce",
    "bigcommerce",
    "demandware",
    "salesforce",
    "__next_data__",
    "algolia",
    "constructor.io",
    "price",
]


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=14, context=CTX) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw)
        return resp.status, raw


for slug, bases in BRANDS.items():
    found = False
    for base in bases:
        try:
            _status, raw = fetch(f"{base.rstrip('/')}/products.json?limit=250")
            products = json.loads(raw).get("products", [])
            first = products[0].get("title", "") if products else ""
            print(f"{slug:22s} SHOPIFY {len(products):3d} {base} first={first[:60]}", flush=True)
            found = True
            break
        except Exception:
            pass
    if found:
        continue
    base = bases[0]
    try:
        status, raw = fetch(base)
        text = raw.decode("utf-8", errors="ignore")
        lowered = text[:80000].lower()
        hints = [hint for hint in HINTS if hint in lowered]
        title = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
        print(f"{slug:22s} NO_SHOPIFY {status} hints={hints} title={(title.group(1).strip()[:70] if title else '')!r}", flush=True)
    except Exception as exc:
        print(f"{slug:22s} ERR {type(exc).__name__}: {str(exc)[:100]}", flush=True)
