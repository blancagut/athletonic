import urllib.request, ssl, certifi, json
ctx = ssl.create_default_context(cafile=certifi.where())
HDR={"User-Agent":"Mozilla/5.0 Chrome/124"}

# Big list of supplement retailers + sports nutrition stores that often run Shopify
hosts = [
    # already-tested-200
    "https://www.tigerfitness.com",
    "https://www.supplementhunt.com",
    "https://www.suppz.com",
    "https://www.swansonvitamins.com",
    "https://www.pipingrock.com",
    # to test
    "https://nutrishop.com",
    "https://www.priceplow.com",
    "https://www.thefeed.com",  # endurance supplements
    "https://www.myvitamins.com",
    "https://www.bulksupplements.com",
    "https://blackmarketlabs.com",
    "https://gnchq.com",
    "https://www.predatornutrition.com",
    "https://www.bodybuilding.com",
    "https://www.thesupplementwarehouse.com",
    "https://strongsupplementshop.com",
    "https://www.muscleandstrength.com",
    "https://www.iherb.com",
    "https://www.luckyvitamin.com",
    "https://supplementsource.ca",
    "https://www.popeyessupplements.com",
    "https://www.popeyescanada.com",
    "https://nationalnutrition.ca",
    "https://www.bodybuilding.com.au",
    "https://www.trueprotein.com.au",
    "https://www.vitaminshoppe.com",
    "https://i-supplements.com",
    "https://nutritionwarehouse.com.au",
    "https://www.amino-z.com.au",
    "https://www.nz-muscle.co.nz",
    "https://www.eu.bestbodyco.com",
    "https://thefitlifeforyou.com",
    "https://shop.bulknutrients.com.au",
    "https://www.bulknutrients.com.au",
    "https://www.maxshealth.com.au",
    "https://www.protein.com.au",
    "https://nutritionwarehouse.com.au",
    "https://www.fortheloveofsport.com",
    "https://supplementmart.com.au",
    "https://www.discount-supplements.co.uk",
    "https://www.predatornutrition.com",
    "https://www.bodyandfit.com",
    "https://www.bulk.com",
    "https://www.thenutritionforce.com",
    "https://www.affordablesupplements.net",
    "https://www.nutristore.com",
]

def probe(host):
    try:
        r = urllib.request.urlopen(urllib.request.Request(f"{host}/products.json?limit=1", headers=HDR), context=ctx, timeout=8)
        if r.status == 200:
            d = json.loads(r.read())
            if d.get("products"): return "OK"
    except urllib.error.HTTPError as e:
        return f"HTTP{e.code}"
    except Exception as e:
        return f"ERR{type(e).__name__}"
    return "EMPTY"

for h in hosts:
    print(f"  {probe(h):<10}  {h}")
