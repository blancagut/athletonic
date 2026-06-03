from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import BRANDS, DATA_DIR, DB_PATH
from seo_sem_classifier import classify_product, classify_products, output_json


DEFAULT_OUTPUT = Path(DATA_DIR) / "seo_sem_classification.json"
DEFAULT_SPLIT_DIR = Path(DATA_DIR) / "seo_sem_products"
MAX_STEM_LENGTH = 180
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clasifica productos del marketplace para SEO/SEM LATAM y devuelve JSON valido."
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--input", type=Path, help="Archivo JSON con un producto o una lista de productos.")
    source.add_argument("--stdin", action="store_true", help="Lee un producto o lista de productos desde stdin.")
    source.add_argument("--db", action="store_true", help="Clasifica productos activos desde SQLite.")
    parser.add_argument("--brand", help="Filtra por brand slug al leer desde SQLite.")
    parser.add_argument("--product-id", help="Filtra por product_id al leer desde SQLite.")
    parser.add_argument("--limit", type=int, help="Limita filas al leer desde SQLite.")
    parser.add_argument("--country", default="LATAM", help="Pais objetivo: MX, CO, CL o LATAM.")
    parser.add_argument("--output", type=Path, help="Ruta de salida JSON. En modo --db usa esta ruta o la ruta default.")
    parser.add_argument("--split-dir", type=Path, help="Escribe un JSON por producto en este directorio.")
    parser.add_argument("--compact", action="store_true", help="JSON sin indentacion.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pretty = not args.compact
    if args.stdin:
        payload = json.load(sys.stdin)
        result = classify_payload(payload, args.country)
        if args.split_dir and isinstance(result, list):
            split_dir = country_split_dir(args.split_dir, args.country)
            write_split_files(payload, result, split_dir, pretty)
        print(output_json(result, pretty=pretty))
        return

    if args.input:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        result = classify_payload(payload, args.country)
        if args.split_dir and isinstance(result, list):
            split_dir = country_split_dir(args.split_dir, args.country)
            write_split_files(payload, result, split_dir, pretty)
        write_or_print(result, args.output, pretty)
        return

    rows = load_products_from_db(args)
    result = classify_products(rows)
    output_path = args.output or DEFAULT_OUTPUT
    split_dir = country_split_dir(args.split_dir or DEFAULT_SPLIT_DIR, args.country)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output_json(result, pretty=pretty) + "\n", encoding="utf-8")
    write_split_files(rows, result, split_dir, pretty)
    print(output_json({"output": str(output_path), "split_dir": str(split_dir), "count": len(result)}, pretty=pretty))


def classify_payload(payload: Any, country: str) -> Any:
    if isinstance(payload, list):
        return classify_products([with_country(item, country) for item in payload])
    if isinstance(payload, dict):
        return classify_product(with_country(payload, country))
    raise SystemExit("Input JSON must be an object or an array of objects.")


def with_country(product: dict[str, Any], country: str) -> dict[str, Any]:
    if product.get("pais_objetivo") or product.get("country") or product.get("pais"):
        return product
    return {**product, "pais_objetivo": country}


def write_or_print(result: Any, output_path: Path | None, pretty: bool) -> None:
    if not output_path:
        print(output_json(result, pretty=pretty))
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output_json(result, pretty=pretty) + "\n", encoding="utf-8")
    count = len(result) if isinstance(result, list) else 1
    print(output_json({"output": str(output_path), "count": count}, pretty=pretty))


def write_split_files(sources: Any, results: list[dict[str, Any]], split_dir: Path, pretty: bool) -> None:
    split_dir.mkdir(parents=True, exist_ok=True)
    if not isinstance(sources, list):
        return
    for index, (source, result) in enumerate(zip(sources, results, strict=False), start=1):
        if not isinstance(source, dict):
            source = {"nombre": f"producto-{index}"}
        brand_slug = slugify(source.get("_brand_slug") or source.get("marca") or "sin-marca")
        brand_dir = split_dir / brand_slug
        brand_dir.mkdir(parents=True, exist_ok=True)
        stem = product_stem(source, index)
        file_path = brand_dir / f"{stem}.json"
        file_path.write_text(output_json(result, pretty=pretty) + "\n", encoding="utf-8")


def country_split_dir(base_dir: Path, country: str) -> Path:
    return base_dir / slugify(country or "latam")


def product_stem(source: dict[str, Any], index: int) -> str:
    product_id = slugify(source.get("_product_id") or "")
    name = slugify(source.get("nombre") or source.get("producto") or f"producto-{index}")
    if product_id and name:
        combined = f"{product_id}__{name}"
        if len(combined) <= MAX_STEM_LENGTH:
            return combined
        if len(product_id) <= MAX_STEM_LENGTH:
            return product_id
        return product_id[:MAX_STEM_LENGTH].rstrip("-")
    if product_id:
        return product_id[:MAX_STEM_LENGTH].rstrip("-")
    return (name or f"producto-{index}")[:MAX_STEM_LENGTH].rstrip("-")


def slugify(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    clean = NON_ALNUM_RE.sub("-", normalized.lower()).strip("-")
    return clean[:140] or "item"


def load_products_from_db(args: argparse.Namespace) -> list[dict[str, Any]]:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        where = ["COALESCE(available,1)=1", "COALESCE(excluded,0)=0", "COALESCE(discontinued,0)=0"]
        params: list[Any] = []
        if args.brand:
            where.append("brand=?")
            params.append(args.brand)
        if args.product_id:
            where.append("product_id=?")
            params.append(args.product_id)
        query = f"""
            SELECT
                id,
                brand,
                product_id,
                name,
                description_html,
                category,
                price,
                currency,
                category_normalized,
                store_department,
                store_collection
            FROM products
            WHERE {' AND '.join(where)}
            ORDER BY store_priority IS NULL, store_priority, brand, name
        """
        if args.limit:
            query += " LIMIT ?"
            params.append(args.limit)
        rows = con.execute(query, params).fetchall()
        return [db_row_to_product(row, args.country) for row in rows]
    finally:
        con.close()


def db_row_to_product(row: sqlite3.Row, country: str) -> dict[str, Any]:
    ingredients = row["category_normalized"] or ""
    category_parts = [row["category"], row["category_normalized"], row["store_department"], row["store_collection"]]
    brand_slug = row["brand"] or ""
    brand_name = BRANDS.get(brand_slug, {}).get("display_name") or brand_slug.replace("_", " ").title()
    return {
        "nombre": row["name"] or "",
        "marca": brand_name,
        "descripcion": row["description_html"] or "",
        "ingredientes": ingredients,
        "categoria_original": " | ".join(str(part) for part in category_parts if part),
        "precio": row["price"],
        "pais_objetivo": country,
        "_brand_slug": brand_slug,
        "_product_id": row["product_id"],
    }


if __name__ == "__main__":
    main()
