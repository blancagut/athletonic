"""
Probe a large batch of supplement brands for Shopify /products.json access.
Prints brand, product count, sample products.
"""
import asyncio
import ssl
import certifi
import aiohttp

# Expand to 50+ brands — protein, pre-workout, vitamins, fat burners, etc.
BRANDS = [
    # Already have these 10
    # ("Transparent Labs",   "https://www.transparentlabs.com"),
    # ("Gorilla Mind",       "https://gorillamind.com"),
    # ("RAW Nutrition",      "https://www.getrawnutrition.com"),
    # ("Cellucor",           "https://www.cellucor.com"),
    # ("MuscleTech",         "https://www.muscletech.com"),
    # ("Optimum Nutrition",  "https://www.optimumnutrition.com"),

    # Other big brands to check
    ("Ghost Lifestyle",    "https://ghostlifestyle.com"),
    ("Ryse Supplements",   "https://rysesupps.com"),
    ("Axe & Sledge",       "https://axeandsledge.com"),
    ("Redcon1",            "https://redcon1.com"),
    ("Alpha Lion",         "https://alphalion.com"),
    ("Bucked Up",          "https://buckedup.com"),
    ("5% Nutrition",       "https://5percentnutrition.com"),
    ("Huge Supplements",   "https://hugesupplements.com"),
    ("Jacked Factory",     "https://jackedfactory.com"),
    ("PEScience",          "https://pescience.com"),
    ("NutraBio",           "https://www.nutrabio.com"),
    ("AllMax Nutrition",   "https://www.allmax.com"),
    ("MAN Sports",         "https://www.mansports.com"),
    ("Kaged",              "https://www.kaged.com"),
    ("1st Phorm",          "https://1stphorm.com"),
    ("Primeval Labs",      "https://primevallabs.com"),
    ("Hi Tech Pharma",     "https://hitechpharma.com"),
    ("ANS Performance",    "https://www.ansperformance.com"),
    ("Finaflex",           "https://finaflex.com"),
    ("Nutrex",             "https://nutrex.com"),
    ("GAT Sport",          "https://gatsport.com"),
    ("Rule 1 Proteins",    "https://rule1proteins.com"),
    ("MusclePharm",        "https://musclepharm.com"),
    ("Six Star",           "https://www.sixstarnutrition.com"),
    ("Nutricost",          "https://nutricost.com"),
    ("Optimum Health",     "https://optimumhealth.com"),
    ("Allmax",             "https://www.allmaxnutrition.com"),
    ("ProSupps",           "https://prosupps.com"),
    ("Performax Labs",     "https://performaxlabs.com"),
    ("Inspired Nutraceuticals", "https://inspiredusa.com"),
    ("ANS Performance",    "https://www.ansperformance.ca"),
    ("Controlled Labs",    "https://www.controlledlabs.com"),
    ("True Nutrition",     "https://truenutrition.com"),
    ("EHP Labs",           "https://ehplabs.com"),
    ("Switch Nutrition",   "https://switchnutrition.com.au"),
    ("Faction Labs",       "https://factionlabs.com.au"),
    ("Muscle Nation AU",   "https://musclenation.com.au"),
    ("Maxs Supplements",   "https://www.maxs.com.au"),
    ("Evolve Nutrition",   "https://evolvenutrition.com.au"),
    ("ATP Science",        "https://atpscience.com"),
    ("White Wolf Nutrition", "https://whitewolfnutrition.com"),
    ("Body Science AU",    "https://www.bodyscience.com.au"),
    ("International Protein AU", "https://www.internationalprotein.com.au"),
    ("Aussie Bodies",      "https://aussiebodies.com.au"),
    ("BioTechUSA",         "https://www.biotechusa.com"),
    ("Kevin Levrone",      "https://kevinlevrone.com"),
    ("Scitec Nutrition",   "https://scitecusa.com"),
    ("Rule One",           "https://rule1proteins.com"),
    ("Optimum Sport",      "https://www.optimumnutrition.com"),
    ("Xtend",              "https://drinkxtend.com"),
    ("Cellucor",           "https://cellucor.com"),
    ("Alani Nu",           "https://alaninu.com"),
    ("Bloom Nutrition",    "https://bloomnu.com"),
    ("Woke AF",            "https://dasklabs.com"),
    ("DAS Labs",           "https://dasklabs.com"),
    ("Obvi",               "https://loveobvi.com"),
    ("Cira Nutrition",     "https://cira.com"),
    ("Bare Performance",   "https://bpnsupps.com"),
    ("Rival Nutrition",    "https://rivalus.com"),
    ("Perfect Sports",     "https://www.perfectsports.ca"),
    ("Magnum Nutraceuticals", "https://www.magnumnutraceuticals.com"),
    ("Beyond Yourself",    "https://beyondyourself.com"),
    ("Big Time Nutrition", "https://bigtimenutrition.com"),
]


async def probe(session: aiohttp.ClientSession, name: str, base: str) -> None:
    url = f"{base}/products.json?limit=5"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            if r.status != 200:
                return
            d = await r.json(content_type=None)
            ps = d.get("products", [])
            if not ps:
                return
            # fast total count
            total = 0
            page = 1
            while page <= 40:  # cap at 10,000 products
                async with session.get(
                    f"{base}/products.json?limit=250&page={page}",
                    timeout=aiohttp.ClientTimeout(total=20),
                ) as r2:
                    d2 = await r2.json(content_type=None)
                pp = d2.get("products", [])
                if not pp:
                    break
                total += len(pp)
                page += 1
            sample_names = [p.get("title", "")[:40] for p in ps[:2]]
            print(f"  OK  {name:<30} {total:>5} products | {sample_names}")
    except Exception:
        pass  # silently skip blocked/unreachable


async def main() -> None:
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx, limit=10)
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    async with aiohttp.ClientSession(connector=conn, headers=headers) as session:
        tasks = [probe(session, name, base) for name, base in BRANDS]
        await asyncio.gather(*tasks)


if __name__ == "__main__":
    print("Probing brands for Shopify API access...")
    asyncio.run(main())
    print("Done.")
