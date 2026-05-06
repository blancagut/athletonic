"""Check which of our brands are stocked on promising new retailers."""
import asyncio
import ssl
import certifi
import aiohttp
from collections import Counter

TARGETS = {
    "optimum_nutrition": ["optimum nutrition", "optimum"],
    "dymatize": ["dymatize"],
    "transparent_labs": ["transparent labs"],
    "raw_nutrition": ["raw nutrition", "raw"],
    "legion_athletics": ["legion athletics", "legion"],
    "gorilla_mind": ["gorilla mind"],
    "muscletech": ["muscletech", "muscle tech"],
    "bsn": ["bsn"],
    "cellucor": ["cellucor", "c4"],
    "myprotein": ["myprotein", "my protein"],
}

RETAILERS = [
    ("Nutrition Warehouse AU", "https://www.nutritionwarehouse.com.au"),
    ("NZ Muscle", "https://www.nzmuscle.co.nz"),
    ("Supplement Hunt", "https://www.supplementhunt.com"),
    ("Gym And Fitness AU", "https://www.gymandfitness.com.au"),
    ("Supps R Us AU", "https://www.suppsrus.com.au"),
    ("Natty Superstore", "https://www.nattysuperstore.com"),
]


def match_brand(vendor: str, name: str, tags: list) -> str | None:
    haystack = f"{vendor} {name} {' '.join(tags)}".lower()
    for slug, needles in TARGETS.items():
        for n in needles:
            if n in haystack:
                return slug
    return None


async def check_retailer(session: aiohttp.ClientSession, name: str, base: str) -> None:
    brand_counts: Counter = Counter()
    vendor_samples: dict = {}
    total = 0
    page = 1
    while True:
        url = f"{base}/products.json?limit=250&page={page}"
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as r:
                if r.status != 200:
                    break
                d = await r.json(content_type=None)
        except Exception:
            break
        ps = d.get("products", [])
        if not ps:
            break
        total += len(ps)
        for p in ps:
            vendor = (p.get("vendor") or "").strip()
            pname = (p.get("title") or "").strip()
            tags = p.get("tags") or []
            brand = match_brand(vendor, pname, tags)
            if brand:
                brand_counts[brand] += 1
                if brand not in vendor_samples:
                    vendor_samples[brand] = vendor
        page += 1

    matched = sum(brand_counts.values())
    print(f"\n{name} ({total} total products, {matched} matched):")
    for slug, cnt in sorted(brand_counts.items()):
        print(f"  {slug:<25} {cnt:>4}  [vendor: {vendor_samples.get(slug,'')}]")
    if not brand_counts:
        print("  (none of our brands found)")


async def main() -> None:
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx)
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    async with aiohttp.ClientSession(connector=conn, headers=headers) as session:
        for name, base in RETAILERS:
            await check_retailer(session, name, base)


if __name__ == "__main__":
    asyncio.run(main())
