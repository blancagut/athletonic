import urllib.request, ssl, certifi, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 Chrome/124"}

# Get FULL vendor list across our active brand catalog from each viable retailer.
# We want comprehensive vendor maps.

# Our 71 active brand slugs
import re
config_text = open('config.py').read()
slugs = re.findall(r'^\s*"([a-z][a-z0-9_]+)":\s*\{', config_text, re.MULTILINE)
print(f"Our brand slugs: {len(slugs)}")

hosts = [
    "https://www.thefeed.com",
    "https://supplementmart.com.au",
    "https://supplementsource.ca",
    "https://www.discount-supplements.co.uk",
    "https://www.bodybuilding.com",
]

# Vendor name aliases for our brands (lowercased, partial-match needles)
brand_needles = {
    "transparent_labs": ["transparent labs"],
    "gorilla_mind": ["gorilla mind"],
    "raw_nutrition": ["raw nutrition","getraw nutrition"],
    "cellucor": ["cellucor","c4 energy","c4 ultimate"],
    "muscletech": ["muscletech","muscle tech"],
    "legion_athletics": ["legion"],
    "optimum_nutrition": ["optimum nutrition","optimum"],
    "dymatize": ["dymatize"],
    "bsn": ["bsn"],
    "myprotein": ["myprotein","my protein"],
    "ghost_lifestyle": ["ghost"],
    "redcon1": ["redcon"],
    "alpha_lion": ["alpha lion"],
    "axe_sledge": ["axe & sledge","axe sledge","axe and sledge"],
    "five_percent_nutrition": ["5%","five percent","rich piana"],
    "huge_supplements": ["huge supplement"],
    "jacked_factory": ["jacked factory"],
    "pescience": ["pescience","p.e.science","p e science"],
    "ryse_supplements": ["ryse"],
    "musclepharm": ["musclepharm"],
    "ritual": ["ritual"],
    "cymbiotika": ["cymbiotika"],
    "hilma": ["hilma"],
    "orgain": ["orgain"],
    "vega": ["vega"],
    "navitas_organics": ["navitas"],
    "amazing_grass": ["amazing grass"],
    "terrasoul_superfoods": ["terrasoul"],
    "nested_naturals": ["nested naturals"],
    "maryruth_organics": ["maryruth"],
    "kos": ["kos"],
    "therabody": ["therabody","theragun"],
    "hyperice": ["hyperice"],
    "compex": ["compex"],
    "soylent": ["soylent"],
    "ample": ["ample"],
    "owyn": ["owyn"],
    "true_nutrition": ["true nutrition"],
    "nuun": ["nuun"],
    "skratch_labs": ["skratch"],
    "drip_drop": ["drip drop","dripdrop"],
    "key_nutrients": ["key nutrients"],
    "onnit": ["onnit"],
    "performance_lab": ["performance lab"],
    "magic_mind": ["magic mind"],
    "elysium": ["elysium"],
    "tru_niagen": ["tru niagen"],
    "renue_by_science": ["renue by science"],
    "manta_sleep": ["manta sleep"],
    "liquid_iv": ["liquid iv","liquid i.v."],
    "novos_labs": ["novos"],
    "vital_proteins": ["vital proteins"],
    "mud_wtr": ["mud","mud wtr"],
    "four_sigmatic": ["four sigmatic"],
    "bare_performance": ["bare performance","bpn"],
    "nutrabio": ["nutrabio"],
    "nuzest": ["nuzest"],
    "primal_kitchen": ["primal kitchen"],
    "momentous": ["momentous"],
    "bloom_nutrition": ["bloom nutrition"],
    "swolverine": ["swolverine"],
    "first_phorm": ["1st phorm","first phorm"],
    "kaged": ["kaged"],
    "naked_nutrition": ["naked nutrition"],
    "olly": ["olly"],
    "promix": ["promix"],
    "garden_of_life": ["garden of life"],
    "thorne": ["thorne"],
    "nordic_naturals": ["nordic naturals"],
    "now_foods": ["now foods","now sports"],
    "centrum": ["centrum"],
    "pure_encapsulations": ["pure encapsulations"],
}

for host in hosts:
    print(f"\n=== {host} ===")
    vendors = {}
    total = 0
    for p in range(1, 80):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f"{host}/products.json?limit=250&page={p}", headers=HDR), context=ctx, timeout=20)
            d = json.loads(r.read())
            ps = d.get("products",[])
            if not ps: break
            for prod in ps:
                v = (prod.get("vendor") or "").strip()
                vendors[v] = vendors.get(v,0)+1
            total += len(ps)
            if len(ps) < 250: break
        except Exception as e:
            print(f"  err p{p}: {e}"); break
    print(f"  total={total} vendors={len(vendors)}")

    matches = {}
    for slug, needles in brand_needles.items():
        cnt = 0
        names = []
        for v, c in vendors.items():
            vl = v.lower()
            for n in needles:
                if n in vl:
                    cnt += c
                    names.append(f"{v}({c})")
                    break
        if cnt > 0:
            matches[slug] = (cnt, names)
    for slug, (cnt, names) in sorted(matches.items(), key=lambda x:-x[1][0]):
        print(f"  {slug:<22} -> {cnt:>4}  {', '.join(names[:3])}")
