"""Quick probe script to find Shopify retailers carrying our brands."""
import asyncio
import ssl
import certifi
import aiohttp

RETAILERS = [
    ("Strong Supplement Shop", "https://www.strongsupplementshop.com"),
    ("Natty Superstore", "https://www.nattysuperstore.com"),
    ("NutriShop", "https://nutrishopusa.com"),
    ("Popeyes CA", "https://popeyes.ca"),
    ("Nutrition Warehouse AU", "https://www.nutritionwarehouse.com.au"),
    ("SND Canada", "https://sndcanada.com"),
    ("Supplement Hunt", "https://www.supplementhunt.com"),
    ("NZ Muscle", "https://www.nzmuscle.co.nz"),
    ("Same Day Supplements", "https://samedaysupplements.com"),
    ("Ill Pump You Up", "https://www.illpumpyouup.com"),
    ("Swolverine", "https://swolverine.com"),
    ("Lucky Vitamin", "https://www.luckyvitamin.com"),
    ("Supps R Us AU", "https://www.suppsrus.com.au"),
    ("Gym And Fitness AU", "https://www.gymandfitness.com.au"),
]

TARGET = ["optimum", "dymatize", "bsn", "myprotein", "muscletech",
          "gorilla", "transparent", "raw", "cellucor", "c4", "legion"]


async def probe(session: aiohttp.ClientSession, name: str, base: str) -> None:
    url = f"{base}/products.json?limit=10"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=12)) as r:
            if r.status != 200:
                print(f"  -- {name}: HTTP {r.status}")
                return
            d = await r.json(content_type=None)
            ps = d.get("products", [])
            if not ps:
                print(f"  -- {name}: no products")
                return
            # count all pages
            total = 0
            page = 1
            while True:
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
            vendors = {p.get("vendor", "") for p in ps}
            our = [v for v in vendors if any(b in v.lower() for b in TARGET)]
            print(f"  OK {name}: {total} total products | our brands sample: {our}")
    except Exception as e:
        print(f"  !! {name}: {type(e).__name__}")


async def main() -> None:
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx)
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    async with aiohttp.ClientSession(connector=conn, headers=headers) as session:
        for name, base in RETAILERS:
            await probe(session, name, base)


if __name__ == "__main__":
    asyncio.run(main())
