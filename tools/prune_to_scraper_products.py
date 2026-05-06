import argparse
import asyncio
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import DB_PATH
from main import SCRAPER_MAP
from utils.storage import init_db, upsert_product


async def prune_brand(slug: str) -> None:
    scraper_cls = SCRAPER_MAP.get(slug)
    if not scraper_cls:
        raise SystemExit(f"No scraper registered for {slug}")

    scraper = scraper_cls()
    products = await scraper.scrape()
    keep_ids = [str(product["product_id"]) for product in products]
    for product in products:
        upsert_product(product)

    if not keep_ids:
        print(f"{slug}: scraper returned 0 products; skipped pruning")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON;")
    placeholders = ",".join("?" for _ in keep_ids)
    with conn:
        before = conn.execute("SELECT COUNT(*) FROM products WHERE brand=?", (slug,)).fetchone()[0]
        conn.execute(
            f"DELETE FROM products WHERE brand=? AND product_id NOT IN ({placeholders})",
            (slug, *keep_ids),
        )
        after = conn.execute("SELECT COUNT(*) FROM products WHERE brand=?", (slug,)).fetchone()[0]
    conn.close()
    print(f"{slug}: kept {after} products, removed {before - after}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Prune DB products to the current scraper result set.")
    parser.add_argument("brands", nargs="+", help="Brand slugs to prune")
    args = parser.parse_args()

    init_db()
    for slug in args.brands:
        await prune_brand(slug)


if __name__ == "__main__":
    asyncio.run(main())