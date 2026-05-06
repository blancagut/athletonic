"""
SQLite storage layer.

Schema
──────
products        – one row per unique (brand, product_id)
variants        – one row per variant  (FK → products)
images          – one row per image    (FK → products)
"""
import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List

from config import DB_PATH, DATA_DIR
from utils.logger import get_logger

log = get_logger(__name__)


# ── helpers ────────────────────────────────────────────────────────────────────

def _connect() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = _connect()
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                brand             TEXT    NOT NULL,
                product_id        TEXT    NOT NULL,
                sku               TEXT,
                name              TEXT    NOT NULL,
                handle            TEXT,
                url               TEXT,
                description_html  TEXT,
                category          TEXT,
                tags              TEXT,   -- JSON array
                price             REAL,
                compare_at_price  REAL,
                currency          TEXT    DEFAULT 'USD',
                available         INTEGER DEFAULT 1,
                options           TEXT,   -- JSON array
                scraped_at        TEXT,
                UNIQUE(brand, product_id)
            );

            CREATE TABLE IF NOT EXISTS variants (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                product_row_id   INTEGER REFERENCES products(id) ON DELETE CASCADE,
                brand            TEXT    NOT NULL,
                product_id       TEXT    NOT NULL,
                variant_id       TEXT    NOT NULL,
                title            TEXT,
                sku              TEXT,
                option1          TEXT,
                option2          TEXT,
                option3          TEXT,
                price            REAL,
                compare_at_price REAL,
                available        INTEGER DEFAULT 1,
                weight_grams     INTEGER,
                UNIQUE(brand, variant_id)
            );

            CREATE TABLE IF NOT EXISTS images (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                product_row_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                brand          TEXT    NOT NULL,
                product_id     TEXT    NOT NULL,
                position       INTEGER DEFAULT 0,
                url            TEXT    NOT NULL,
                local_path     TEXT,
                alt            TEXT,
                width          INTEGER,
                height         INTEGER,
                UNIQUE(brand, product_id, url)
            );
            """
        )
    conn.close()
    log.debug("DB initialised at %s", DB_PATH)


# ── write ──────────────────────────────────────────────────────────────────────

def upsert_product(product: Dict[str, Any]) -> int:
    """Insert or replace a product. Returns the products.id row id."""
    conn = _connect()
    brand      = product["brand"]
    product_id = str(product["product_id"])
    now        = datetime.utcnow().isoformat()

    with conn:
        cur = conn.execute(
            """
            INSERT INTO products
                (brand, product_id, sku, name, handle, url,
                 description_html, category, tags, price,
                 compare_at_price, currency, available, options, scraped_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(brand, product_id) DO UPDATE SET
                sku              = excluded.sku,
                name             = excluded.name,
                handle           = excluded.handle,
                url              = excluded.url,
                description_html = excluded.description_html,
                category         = excluded.category,
                tags             = excluded.tags,
                price            = excluded.price,
                compare_at_price = excluded.compare_at_price,
                currency         = excluded.currency,
                available        = excluded.available,
                options          = excluded.options,
                scraped_at       = excluded.scraped_at
            """,
            (
                brand,
                product_id,
                product.get("sku"),
                product.get("name", ""),
                product.get("handle"),
                product.get("url"),
                product.get("description_html"),
                product.get("category"),
                json.dumps(product.get("tags", [])),
                product.get("price"),
                product.get("compare_at_price"),
                product.get("currency", "USD"),
                1 if product.get("available", True) else 0,
                json.dumps(product.get("options", [])),
                now,
            ),
        )
        row_id = cur.lastrowid or conn.execute(
            "SELECT id FROM products WHERE brand=? AND product_id=?",
            (brand, product_id),
        ).fetchone()["id"]

        # variants
        for v in product.get("variants", []):
            conn.execute(
                """
                INSERT INTO variants
                    (product_row_id, brand, product_id, variant_id, title, sku,
                     option1, option2, option3, price, compare_at_price,
                     available, weight_grams)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(brand, variant_id) DO UPDATE SET
                    title            = excluded.title,
                    sku              = excluded.sku,
                    option1          = excluded.option1,
                    option2          = excluded.option2,
                    option3          = excluded.option3,
                    price            = excluded.price,
                    compare_at_price = excluded.compare_at_price,
                    available        = excluded.available,
                    weight_grams     = excluded.weight_grams
                """,
                (
                    row_id,
                    brand,
                    product_id,
                    str(v.get("variant_id", "")),
                    v.get("title"),
                    v.get("sku"),
                    v.get("option1"),
                    v.get("option2"),
                    v.get("option3"),
                    v.get("price"),
                    v.get("compare_at_price"),
                    1 if v.get("available", True) else 0,
                    v.get("weight_grams"),
                ),
            )

        # images
        for idx, img in enumerate(product.get("images", [])):
            conn.execute(
                """
                INSERT INTO images
                    (product_row_id, brand, product_id, position, url,
                     local_path, alt, width, height)
                VALUES (?,?,?,?,?,?,?,?,?)
                ON CONFLICT(brand, product_id, url) DO UPDATE SET
                    local_path = excluded.local_path,
                    alt        = excluded.alt,
                    width      = excluded.width,
                    height     = excluded.height
                """,
                (
                    row_id,
                    brand,
                    product_id,
                    img.get("position", idx),
                    img.get("url", ""),
                    img.get("local_path"),
                    img.get("alt"),
                    img.get("width"),
                    img.get("height"),
                ),
            )

    conn.close()
    return row_id


def update_image_local_path(brand: str, product_id: str, url: str, local_path: str) -> None:
    conn = _connect()
    with conn:
        conn.execute(
            "UPDATE images SET local_path=? WHERE brand=? AND product_id=? AND url=?",
            (local_path, brand, str(product_id), url),
        )
    conn.close()


# ── export ─────────────────────────────────────────────────────────────────────

def export_to_json(brand: str | None = None) -> str:
    """Export products (optionally filtered by brand) to a JSON file."""
    conn = _connect()
    where = "WHERE p.brand = ?" if brand else ""
    params = (brand,) if brand else ()

    rows = conn.execute(
        f"""
        SELECT p.*, GROUP_CONCAT(i.url, '|||') AS image_urls
        FROM products p
        LEFT JOIN images i ON i.product_row_id = p.id
        {where}
        GROUP BY p.id
        ORDER BY p.brand, p.name
        """,
        params,
    ).fetchall()

    out: List[Dict] = []
    for r in rows:
        d = dict(r)
        d["tags"]    = json.loads(d.get("tags") or "[]")
        d["options"] = json.loads(d.get("options") or "[]")
        d["image_urls"] = (d.get("image_urls") or "").split("|||") if d.get("image_urls") else []
        out.append(d)

    slug = brand or "all_brands"
    path = os.path.join(DATA_DIR, f"{slug}_products.json")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    conn.close()
    log.info("Exported %d products → %s", len(out), path)
    return path


def export_to_csv(brand: str | None = None) -> str:
    """Export to CSV suitable for WooCommerce / generic import."""
    import csv

    conn = _connect()
    where = "WHERE p.brand = ?" if brand else ""
    params = (brand,) if brand else ()

    rows = conn.execute(
        f"""
        SELECT
            p.brand, p.product_id, p.sku, p.name, p.handle, p.url,
            p.category, p.tags, p.price, p.compare_at_price,
            p.currency, p.available, p.scraped_at,
            GROUP_CONCAT(DISTINCT i.url)  AS image_urls
        FROM products p
        LEFT JOIN images i ON i.product_row_id = p.id
        {where}
        GROUP BY p.id
        ORDER BY p.brand, p.name
        """,
        params,
    ).fetchall()

    slug = brand or "all_brands"
    path = os.path.join(DATA_DIR, f"{slug}_products.csv")
    os.makedirs(DATA_DIR, exist_ok=True)

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Brand", "Product ID", "SKU", "Name", "Handle", "URL",
            "Category", "Tags", "Price", "Compare At Price",
            "Currency", "Available", "Scraped At", "Image URLs",
        ])
        for r in rows:
            writer.writerow(list(r))

    conn.close()
    log.info("Exported CSV → %s", path)
    return path


def get_counts() -> Dict[str, int]:
    conn = _connect()
    rows = conn.execute(
        "SELECT brand, COUNT(*) AS cnt FROM products GROUP BY brand ORDER BY brand"
    ).fetchall()
    conn.close()
    return {r["brand"]: r["cnt"] for r in rows}
