from __future__ import annotations

import json
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Tuple

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import BRANDS, DATA_DIR, DB_PATH
from store_taxonomy import (
    APPAREL_FIRST_BRANDS,
    COLLECTIONS,
    FIGHT_GEAR_BRANDS,
    HOMEPAGE_SECTIONS,
    PRIMARY_DEPARTMENTS,
    SOCCER_BRANDS,
    TOP_NAVIGATION,
    WOMENS_WELLNESS_BRANDS,
)


DEPARTMENT_BY_SLUG = {item["slug"]: item for item in PRIMARY_DEPARTMENTS}

NORMALIZED_CATEGORY_MAP: Dict[str, Tuple[str, str]] = {
    "Pre-Workout": ("sports_nutrition", "pre_workout"),
    "Post-Workout / Recovery": ("sports_nutrition", "recovery"),
    "Creatine": ("sports_nutrition", "creatine"),
    "BCAA / EAA": ("sports_nutrition", "amino_acids"),
    "Glutamine": ("supplements", "amino_acids"),
    "HMB": ("sports_nutrition", "recovery"),
    "Hydration / Electrolytes": ("wellness_goals", "energy_hydration"),
    "Energy Drink": ("wellness_goals", "energy_hydration"),
    "Protein - Whey Isolate": ("sports_nutrition", "protein"),
    "Protein - Casein": ("sports_nutrition", "protein"),
    "Protein - Plant": ("sports_nutrition", "protein"),
    "Protein - Collagen": ("womens_wellness", "collagen_beauty"),
    "Protein - Mass Gainer": ("sports_nutrition", "mass_gainers"),
    "Protein - Whey Blend": ("sports_nutrition", "protein"),
    "Protein - Generic": ("sports_nutrition", "protein"),
    "Protein Bar": ("functional_foods", "protein_bars"),
    "RTD Protein Shake": ("functional_foods", "rtd_shakes"),
    "Meal Replacement": ("functional_foods", "meal_replacement"),
    "Snack / Bar": ("functional_foods", "snacks"),
    "Functional Beverage": ("functional_foods", "functional_drinks"),
    "Collagen": ("womens_wellness", "collagen_beauty"),
    "Hair / Skin / Nails": ("womens_wellness", "hair_skin_nails"),
    "Skincare": ("womens_wellness", "collagen_beauty"),
    "Peptides": ("womens_wellness", "collagen_beauty"),
    "Greens / Superfoods": ("supplements", "greens_superfoods"),
    "Probiotics / Gut": ("wellness_goals", "gut_health"),
    "Nootropic / Focus": ("wellness_goals", "focus_mood"),
    "Fat Burner": ("wellness_goals", "weight_management"),
    "Testosterone / Hormone": ("wellness_goals", "weight_management"),
    "Sleep Aid": ("wellness_goals", "sleep_stress"),
    "Joint Support": ("vitamins_health", "joint_support"),
    "Omega / Fish Oil": ("vitamins_health", "omega_fish_oil"),
    "Longevity": ("wellness_goals", "longevity"),
    "Mushroom": ("supplements", "adaptogens_herbals"),
    "Adaptogen / Herbal": ("supplements", "adaptogens_herbals"),
    "Multivitamin": ("vitamins_health", "multivitamins"),
    "Vitamin D": ("vitamins_health", "vitamins_minerals"),
    "Vitamin C": ("vitamins_health", "immune_support"),
    "Vitamin B Complex": ("vitamins_health", "vitamins_minerals"),
    "Magnesium": ("vitamins_health", "vitamins_minerals"),
    "Zinc": ("vitamins_health", "vitamins_minerals"),
    "Iron": ("vitamins_health", "vitamins_minerals"),
    "Calcium": ("vitamins_health", "vitamins_minerals"),
    "Single-Vitamin / Mineral": ("vitamins_health", "vitamins_minerals"),
    "Organ Meat / Whole Food": ("supplements", "all_supplements"),
    "Recovery Device": ("wellness_devices", "recovery_devices"),
    "Sleep Gear": ("wellness_devices", "sleep_gear"),
    "Wearable": ("wellness_devices", "wearables"),
    "Bundle": ("supplements", "all_supplements"),
    "Sample": ("supplements", "all_supplements"),
    "Gift Card": ("other", "needs_review"),
    "Apparel": ("apparel_accessories", "apparel"),
    "Accessories": ("apparel_accessories", "bags_bottles"),
    "Other": ("other", "needs_review"),
}

HEALTH_TEXT_RE = re.compile(
    r"supplement|vitamin|mineral|capsule|tablet|powder|protein|collagen|probiotic|prebiotic|"
    r"greens?|superfood|electrolyte|hydration|creatine|amino|omega|fish oil|magnesium|"
    r"sleep|gut|hormone|menopause|prenatal|postnatal|stress|focus|longevity|beauty|"
    r"hair|skin|nails|immune|joint|adaptogen|mushroom|colostrum",
    re.I,
)
SOCCER_TEXT_RE = re.compile(r"soccer|football|jersey|kit\b|cleat|boot|ball|goalkeeper|glove|scarf|club|fc\b|fifa|world cup", re.I)
SHOE_TEXT_RE = re.compile(r"shoe|sneaker|runner|running|trainer|cleat|boot", re.I)
JERSEY_TEXT_RE = re.compile(r"jersey|kit\b|shirt", re.I)
FIGHT_TEXT_RE = re.compile(r"boxing|mma|muay thai|bjj|martial|glove|shin|mouthguard|gi\b|rashguard|fight", re.I)
WOMENS_TEXT_RE = re.compile(r"women|woman|womens|prenatal|postnatal|menopause|period|pms|hormone|collagen|beauty|hair|skin|nails", re.I)


def ensure_store_columns(con: sqlite3.Connection) -> None:
    columns = {row[1] for row in con.execute("PRAGMA table_info(products)")}
    statements = []
    if "store_department" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN store_department TEXT")
    if "store_collection" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN store_collection TEXT")
    if "store_priority" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN store_priority INTEGER")
    for statement in statements:
        con.execute(statement)
    if statements:
        con.commit()


def row_text(row: sqlite3.Row) -> str:
    tags = row["tags"] or ""
    try:
        parsed = json.loads(tags) if isinstance(tags, str) and tags.startswith("[") else tags
        if isinstance(parsed, list):
            tags = " ".join(str(item) for item in parsed)
    except Exception:
        pass
    parts = [row["brand"], row["name"], row["category"], row["category_normalized"], tags]
    return " | ".join(str(part or "") for part in parts)


def classify(row: sqlite3.Row) -> tuple[str, str, int]:
    brand = row["brand"]
    normalized = row["category_normalized"] or "Other"
    text = row_text(row)

    if brand in SOCCER_BRANDS or SOCCER_TEXT_RE.search(text):
        if JERSEY_TEXT_RE.search(text):
            return "sports_gear", "soccer_jerseys", 80
        if SHOE_TEXT_RE.search(text):
            return "sports_gear", "soccer_cleats", 82
        return "sports_gear", "soccer_accessories", 84

    if brand in FIGHT_GEAR_BRANDS or FIGHT_TEXT_RE.search(text):
        return "sports_gear", "fight_gear", 86

    if brand in WOMENS_WELLNESS_BRANDS or WOMENS_TEXT_RE.search(text):
        if re.search(r"prenatal|postnatal|pregnan|mom|natal", text, re.I):
            return "womens_wellness", "prenatal_postnatal", 22
        if re.search(r"menopause|perimenopause", text, re.I):
            return "womens_wellness", "menopause", 24
        if re.search(r"hormone|period|pms|cycle", text, re.I):
            return "womens_wellness", "hormone_support", 26
        if re.search(r"hair|skin|nails|biotin", text, re.I):
            return "womens_wellness", "hair_skin_nails", 28
        if re.search(r"collagen|beauty|glow|anti[ -]?aging|ageless", text, re.I):
            return "womens_wellness", "collagen_beauty", 20

    if brand in APPAREL_FIRST_BRANDS:
        if SHOE_TEXT_RE.search(text):
            return "apparel_accessories", "shoes", 90
        if normalized == "Accessories":
            return "apparel_accessories", "bags_bottles", 92
        if HEALTH_TEXT_RE.search(text) and normalized not in {"Apparel", "Accessories", "Other"}:
            department, collection = NORMALIZED_CATEGORY_MAP.get(normalized, ("supplements", "all_supplements"))
            return department, collection, 35
        return "apparel_accessories", "apparel", 91

    department, collection = NORMALIZED_CATEGORY_MAP.get(normalized, ("other", "needs_review"))
    if department == "other" and HEALTH_TEXT_RE.search(text):
        return "supplements", "all_supplements", 45
    return department, collection, int(DEPARTMENT_BY_SLUG.get(department, {}).get("priority", 99))


def collection_lookup(department_slug: str) -> dict[str, dict[str, Any]]:
    return {collection["slug"]: collection for collection in COLLECTIONS.get(department_slug, [])}


def sample_products(con: sqlite3.Connection, department: str, collection: str, limit: int = 8) -> list[dict[str, Any]]:
    rows = con.execute(
        """
        SELECT brand, name, price, currency, url
        FROM products
        WHERE store_department=? AND store_collection=? AND COALESCE(available,1)=1
        ORDER BY price IS NULL, scraped_at DESC, name
        LIMIT ?
        """,
        (department, collection, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def brand_counts(con: sqlite3.Connection, department: str, limit: int = 20) -> list[dict[str, Any]]:
    rows = con.execute(
        """
        SELECT brand, COUNT(*) AS count
        FROM products
        WHERE store_department=?
        GROUP BY brand
        ORDER BY count DESC, brand
        LIMIT ?
        """,
        (department, limit),
    ).fetchall()
    return [
        {
            "slug": row["brand"],
            "name": BRANDS.get(row["brand"], {}).get("display_name", row["brand"]),
            "count": row["count"],
        }
        for row in rows
    ]


def assign_products(con: sqlite3.Connection) -> Counter:
    ensure_store_columns(con)
    rows = con.execute(
        """
        SELECT id, brand, name, category, tags, COALESCE(category_normalized, category, 'Other') AS category_normalized
        FROM products
        """
    ).fetchall()
    updates = []
    counts: Counter = Counter()
    for row in rows:
        department, collection, priority = classify(row)
        updates.append((department, collection, priority, row["id"]))
        counts[department] += 1
    con.executemany("UPDATE products SET store_department=?, store_collection=?, store_priority=? WHERE id=?", updates)
    con.commit()
    return counts


def build_structure(con: sqlite3.Connection) -> dict[str, Any]:
    departments = []
    for department in sorted(PRIMARY_DEPARTMENTS, key=lambda item: item["priority"]):
        slug = department["slug"]
        department_count = con.execute("SELECT COUNT(*) FROM products WHERE store_department=?", (slug,)).fetchone()[0]
        lookup = collection_lookup(slug)
        rows = con.execute(
            """
            SELECT store_collection, COUNT(*) AS count
            FROM products
            WHERE store_department=?
            GROUP BY store_collection
            ORDER BY count DESC
            """,
            (slug,),
        ).fetchall()
        collections = []
        for row in rows:
            collection_slug = row["store_collection"] or "needs_review"
            meta = lookup.get(collection_slug, {"name": collection_slug.replace("_", " ").title(), "priority": 999})
            collections.append(
                {
                    "slug": collection_slug,
                    "name": meta["name"],
                    "priority": meta.get("priority", 999),
                    "product_count": row["count"],
                    "sample_products": sample_products(con, slug, collection_slug),
                }
            )
        collections.sort(key=lambda item: (item["priority"], item["name"]))
        departments.append({**department, "product_count": department_count, "collections": collections, "top_brands": brand_counts(con, slug)})

    top_navigation = [department for nav_slug in TOP_NAVIGATION for department in departments if department["slug"] == nav_slug and department["product_count"] > 0]
    homepage_sections = []
    for section in HOMEPAGE_SECTIONS:
        department = next((item for item in departments if item["slug"] == section["department"]), None)
        if department and department["product_count"] > 0:
            homepage_sections.append({**section, "product_count": department["product_count"], "primary": department["primary"], "collections": department["collections"][:4]})

    primary_slugs = [department["slug"] for department in PRIMARY_DEPARTMENTS if department["primary"]]
    secondary_slugs = [department["slug"] for department in PRIMARY_DEPARTMENTS if not department["primary"]]
    primary_query = "SELECT COUNT(*) FROM products WHERE store_department IN (%s)" % ",".join("?" for _ in primary_slugs)
    secondary_query = "SELECT COUNT(*) FROM products WHERE store_department IN (%s)" % ",".join("?" for _ in secondary_slugs)

    return {
        "store_positioning": {
            "primary_business": "Supplements, vitamins, health, and wellness products",
            "secondary_business": "Apparel, accessories, soccer gear, fight gear, lifestyle shoes, and fan merchandise",
            "merchandising_rule": "Health categories always appear before apparel and sports gear, even when secondary categories have more products.",
        },
        "top_navigation": top_navigation,
        "homepage_sections": homepage_sections,
        "departments": departments,
        "totals": {
            "products": con.execute("SELECT COUNT(*) FROM products").fetchone()[0],
            "active_products": con.execute("SELECT COUNT(*) FROM products WHERE COALESCE(available,1)=1").fetchone()[0],
            "primary_products": con.execute(primary_query, primary_slugs).fetchone()[0],
            "secondary_products": con.execute(secondary_query, secondary_slugs).fetchone()[0],
        },
    }


def write_markdown(structure: dict[str, Any], path: Path) -> None:
    lines = [
        "# Store Structure",
        "",
        "Primary business: supplements, vitamins, health, and wellness.",
        "Secondary business: apparel, accessories, soccer gear, fight gear, shoes, and fan merchandise.",
        "",
        "## Homepage Priority",
    ]
    for section in structure["homepage_sections"]:
        lines.append(f"- {section['title']} ({section['product_count']} products)")
    lines.extend(["", "## Departments"])
    for department in structure["departments"]:
        if department["product_count"] == 0:
            continue
        lane = "Primary" if department["primary"] else "Secondary"
        lines.append(f"\n### {department['name']} - {lane} - {department['product_count']} products")
        lines.append(department["description"])
        for collection in department["collections"]:
            lines.append(f"- {collection['name']}: {collection['product_count']}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    counts = assign_products(con)
    structure = build_structure(con)

    output_dir = Path(DATA_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "store_structure.json"
    md_path = output_dir / "store_structure.md"
    json_path.write_text(json.dumps(structure, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(structure, md_path)
    con.close()

    print("Store departments assigned:")
    for department in sorted(PRIMARY_DEPARTMENTS, key=lambda item: item["priority"]):
        print(f"  {department['name']:<32} {counts[department['slug']]}")
    print(f"\nWrote {json_path}")
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()