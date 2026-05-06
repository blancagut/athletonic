"""Phase 5: Category normalization.

Adds a `category_normalized` column and classifies every product into a unified
taxonomy by matching brand-specific category strings, tags, and product names
against ordered keyword rules.

Priority:
1. Hardware / Devices (Theragun, Hypervolt, masks, ice baths)
2. Apparel
3. Specific supplement classes (Pre-Workout, Creatine, etc.)
4. Generic protein
5. Generic vitamin
6. Functional food
7. Other / Misc
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter
from typing import List, Optional, Tuple

DB_PATH = "output/data/products.db"

# (label, regex). First match wins.
RULES: List[Tuple[str, re.Pattern]] = [
    # ── Hardware / Wearables / Devices ───────────────────────────────────────
    ("Recovery Device",        re.compile(r"theragun|hypervolt|hyperice|massage\s*gun|percussion|massager|normatec|venom|recovery\s*device|ice\s*bath|cold\s*plunge|sauna|infrared|red\s*light|venom\s*back|theraface|rapidreboot|compression\s*boot|lymphatic", re.I)),
    ("Sleep Gear",              re.compile(r"sleep\s*mask|eye\s*mask|earplug|silk\s*pillow|weighted\s*blanket|manta\s*sleep|sound\s*machine", re.I)),
    ("Wearable",                re.compile(r"whoop|oura\s*ring|smart\s*ring|fitness\s*tracker|heart\s*rate\s*monitor", re.I)),

    # ── Apparel & Merch ──────────────────────────────────────────────────────
    ("Apparel",                 re.compile(r"\b(t-?shirt|tee|tees|hoodie|hoody|jogger(s)?|legging(s)?|short(s)?|tank(s)?|crewneck|sweatshirt|sweatpants|jacket|cap|beanie|hat(s)?|sock(s)?|bra|jersey|gym\s*bag|backpack|gym\s*towel)\b|apparel|merch", re.I)),
    ("Accessories",             re.compile(r"shaker|blender\s*bottle|water\s*bottle|tumbler|funnel|pill\s*box|scoop|sticker|bumper|wristband|keychain|sleeve|strap|grip|wrap|belt|gloves|patch", re.I)),

    # ── Specific supplement classes ──────────────────────────────────────────
    ("Pre-Workout",             re.compile(r"pre-?workout|pre-?series|preseries|pre\s*kaged|c4(?!\s*ripped)|\bn\.o\.?\b\s*xplode|jacked|nitric|pump|stim|preworkout|stacked\s*pre|pre\s*formula|\bpre\b\s*(powder|drink)", re.I)),
    ("Post-Workout / Recovery", re.compile(r"post-?workout|post-?series|recovery\s*(formula|drink|powder)|reload|repair|bcaa\s*recovery", re.I)),
    ("Creatine",                re.compile(r"creatine|kre-?alkalyn|hcl\s*creatine", re.I)),
    ("BCAA / EAA",              re.compile(r"\bbcaa(s)?\b|\beaa(s)?\b|amino\s*acid|amino-?lean|amino\s*energy|essential\s*amino", re.I)),
    ("Glutamine",               re.compile(r"l-?glutamine|\bglutamine\b", re.I)),
    ("Collagen",                re.compile(r"collagen|hydrolyzed\s*peptide", re.I)),
    ("Greens / Superfoods",     re.compile(r"\bgreens?\b|super\s*greens?|spirulina|chlorella|wheatgrass|barley\s*grass|reds?\s*powder|fruits?\s*&\s*veg|moringa", re.I)),
    ("Probiotics / Gut",        re.compile(r"probiotic|prebiotic|gut\s*health|digest(ive|ion)|enzyme\s*blend|fiber|psyllium|colostrum", re.I)),
    ("Hydration / Electrolytes", re.compile(r"electrolyte|hydration|hydrate|drip\s*drop|nuun|skratch|liquid\s*i\.?v\.?|element|key\s*nutrients|ors\b|isotonic", re.I)),
    ("Energy Drink",            re.compile(r"energy\s*drink|energy\s*can|energy\s*formula|caffeine\s*drink|rtd", re.I)),
    ("Nootropic / Focus",       re.compile(r"nootropic|focus|cognition|cognitive|brain\s*(health|boost|support)|alpha\s*brain|magic\s*mind|mind\s*lab|lion'?s\s*mane|bacopa|dopamine|serotonin|gaba|memory\s*support", re.I)),
    ("Fat Burner",              re.compile(r"fat\s*burner|thermogenic|hydroxycut|lipo|carnitine|cla\b|weight\s*loss", re.I)),
    ("Testosterone / Hormone",  re.compile(r"test\s*booster|testosterone|test-?booster|tribulus|fadogia|dhea|estrogen|cortisol|adaptogen|ecdy|turkesterone|turk-?plex", re.I)),
    ("Sleep Aid",               re.compile(r"sleep\s*aid|melatonin|sleep\s*formula|sleep\s*support|sleep\s*&\s*recover|night\s*time|magnesium\s*glycinate|valerian|gaba\b|pm\s*formula|\bzma\b|\bzmo\b", re.I)),
    ("Joint Support",           re.compile(r"joint\s*support|glucosamine|chondroitin|msm\b|turmeric|boswellia", re.I)),
    ("Omega / Fish Oil",        re.compile(r"omega-?3|fish\s*oil|krill\s*oil|epa.*dha|cod\s*liver", re.I)),
    ("Longevity",               re.compile(r"longevity|nmn\b|nicotinamide|nad\+?|resveratrol|spermidine|tru\s*niagen|elysium|renue\s*by\s*science|niagen|pterostilbene|rapamycin", re.I)),
    ("Mushroom",                re.compile(r"mushroom|reishi|cordyceps|chaga|maitake|turkey\s*tail|lion'?s\s*mane", re.I)),
    ("Hair / Skin / Nails",     re.compile(r"hair\s*(growth|skin|nails)|biotin|skin\s*care|skincare", re.I)),
    ("Multivitamin",            re.compile(r"multi-?vitamin|multivit|daily\s*essential|men'?s\s*multi|women'?s\s*multi|whole\s*food\s*multi", re.I)),
    ("Vitamin D",               re.compile(r"vitamin\s*d3?|cholecalciferol", re.I)),
    ("Vitamin C",               re.compile(r"vitamin\s*c\b|ascorbic\s*acid|liposomal\s*c", re.I)),
    ("Vitamin B Complex",       re.compile(r"b-?complex|b12|b\s*vitamin|methyl-?b|methylcobalamin", re.I)),
    ("Magnesium",               re.compile(r"\bmagnesium\b|\bmag\s*(am|pm|complex|capsule|glycinate|threonate|citrate)", re.I)),
    ("Zinc",                    re.compile(r"\bzinc\b", re.I)),
    ("Iron",                    re.compile(r"iron\s*(bisglycinate|supplement|capsule|tablet)|ferrous", re.I)),
    ("Calcium",                 re.compile(r"\bcalcium\b", re.I)),
    ("Single-Vitamin / Mineral", re.compile(r"vitamin\s*[a-k]\b|coq10|ubiquinol|alpha\s*lipoic|ala\b|pqq\b|nac\b|n-acetyl|quercetin|selenium|chromium|iodine|potassium|copper", re.I)),
    ("Adaptogen / Herbal",      re.compile(r"ashwagandha|rhodiola|ginseng|tongkat|maca|holy\s*basil|tulsi|astragalus|berberine|milk\s*thistle|eleuthero|sea\s*moss|elixir|sigma\b|lock\s*&\s*load", re.I)),
    ("Peptides",                re.compile(r"\bpeptide(s)?\b|bpc-?157|tb-?500|metabolic\s*peptide", re.I)),
    ("Organ Meat / Whole Food", re.compile(r"beef\s*liver|grass\s*fed\s*organ|desiccated\s*liver|colostrum|bone\s*marrow|ancestral", re.I)),
    ("HMB",                     re.compile(r"\bhmb\b|beta-?hydroxy", re.I)),
    ("CBD / Hemp",              re.compile(r"\bcbd\b|cannabidiol|hemp\s*extract", re.I)),

    # ── Protein (after specific) ─────────────────────────────────────────────
    ("Protein - Whey Isolate",  re.compile(r"whey\s*isolate|iso[-\s]?100|isolate\s*100|hydro-?whey|hydrowhey|isobuild", re.I)),
    ("Protein - Casein",        re.compile(r"casein|micellar", re.I)),
    ("Protein - Plant",          re.compile(r"plant\s*(based)?\s*protein|vegan\s*protein|pea\s*protein|soy\s*protein|rice\s*protein|hemp\s*protein|kos\s*protein", re.I)),
    ("Protein - Collagen",       re.compile(r"collagen\s*protein", re.I)),
    ("Protein - Mass Gainer",    re.compile(r"mass\s*gainer|weight\s*gainer|serious\s*mass|gainer", re.I)),
    ("Protein - Whey Blend",     re.compile(r"\bwhey\b|protein\s*powder|protein\s*blend|elite\s*protein|gold\s*standard|syntha-?6|nitro-?tech|protein\s*formula", re.I)),
    ("Protein Bar",             re.compile(r"protein\s*bar|quest\s*bar", re.I)),
    ("RTD Protein Shake",        re.compile(r"protein\s*shake|protein\s*coffee|rtd\s*protein|ready[-\s]to[-\s]drink", re.I)),
    ("Protein - Generic",        re.compile(r"\bprotein\b", re.I)),

    # ── Functional Food / Meal Replacement ───────────────────────────────────
    ("Meal Replacement",        re.compile(r"meal\s*replacement|complete\s*nutrition|huel|soylent|ample|kachava|ka'?chava|owyn|orgain", re.I)),
    ("Snack / Bar",             re.compile(r"\bbar\b|snack|granola|cookie|brownie|wafer", re.I)),
    ("Functional Beverage",     re.compile(r"functional\s*drink|adaptogenic\s*drink|wellness\s*shot|kombucha", re.I)),

    # ── Skincare ─────────────────────────────────────────────────────────────
    ("Skincare",                re.compile(r"serum|moisturizer|cleanser|toner|sunscreen|spf\b|exfoliant|retinol|hyaluronic\s*acid|niacinamide|peptide\s*cream|face\s*cream|eye\s*cream", re.I)),

    # ── Bundles / Samples / Misc ─────────────────────────────────────────────
    ("Bundle",                  re.compile(r"\bbundle\b|\bstack\b|\bpack\b|combo|kit\b|starter\s*pack|welcome\s*box|gift\s*box|sample\s*pack", re.I)),
    ("Sample",                  re.compile(r"\bsample\b|trial\s*size|travel\s*size", re.I)),
    ("Gift Card",                re.compile(r"gift\s*card|egift", re.I)),
]


def normalize_one(category: str, tags: str, name: str) -> str:
    """Run rules against the concatenation of category, tags, and name."""
    haystack_parts = []
    if category:
        haystack_parts.append(category)
    if tags:
        try:
            t = json.loads(tags) if tags.startswith("[") else tags
            if isinstance(t, list):
                haystack_parts.append(" ".join(str(x) for x in t))
            else:
                haystack_parts.append(str(t))
        except Exception:
            haystack_parts.append(tags)
    if name:
        haystack_parts.append(name)
    haystack = " | ".join(haystack_parts)

    for label, pat in RULES:
        if pat.search(haystack):
            return label
    return "Other"


def ensure_column(con: sqlite3.Connection) -> None:
    cols = {r[1] for r in con.execute("PRAGMA table_info(products)")}
    if "category_normalized" not in cols:
        con.execute("ALTER TABLE products ADD COLUMN category_normalized TEXT")
        con.commit()


def run(dry_run: bool, sample: int) -> None:
    con = sqlite3.connect(DB_PATH)
    ensure_column(con)

    rows = con.execute(
        """SELECT id, name, category, tags FROM products
           WHERE COALESCE(discontinued,0)=0 AND COALESCE(excluded,0)=0"""
    ).fetchall()

    counts: Counter = Counter()
    updates: List[Tuple[str, int]] = []
    for pid, name, cat, tags in rows:
        label = normalize_one(cat or "", tags or "", name or "")
        counts[label] += 1
        updates.append((label, pid))

    print(f"Classified {len(rows)} active products into {len(counts)} buckets:\n")
    for label, n in counts.most_common():
        print(f"  {label:<30} {n}")

    if sample:
        print(f"\n=== SAMPLE 'Other' (up to {sample}) ===")
        other = [u for u in updates if u[0] == "Other"][:sample]
        for label, pid in other:
            r = con.execute(
                "SELECT brand, name, category FROM products WHERE id=?", (pid,)
            ).fetchone()
            print(f"  {r[0]:<25} | {r[2] or '-':<25} | {r[1]}")

    if dry_run:
        print("\n[dry-run] no DB writes")
        return

    cur = con.cursor()
    cur.executemany("UPDATE products SET category_normalized=? WHERE id=?", updates)
    con.commit()
    print(f"\nUpdated {cur.rowcount} rows.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sample", type=int, default=0, help="Show N rows that fell into 'Other'")
    args = ap.parse_args()
    run(args.dry_run, args.sample)


if __name__ == "__main__":
    main()
