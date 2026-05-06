"""
Global configuration for the Sups scraper system.
Adjust rate limits and concurrency here before running.
"""
import os

# ── Output paths ──────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR   = os.path.join(BASE_DIR, "output")
DATA_DIR     = os.path.join(OUTPUT_DIR, "data")
IMAGES_DIR   = os.path.join(OUTPUT_DIR, "images")
DB_PATH      = os.path.join(DATA_DIR, "products.db")

# ── HTTP / crawl settings ─────────────────────────────────────────────────────
REQUEST_TIMEOUT    = 30          # seconds per HTTP request
MAX_RETRIES        = 4           # retry attempts on failure
RETRY_WAIT_MIN     = 2           # seconds – tenacity wait_random_exponential min
RETRY_WAIT_MAX     = 15          # seconds – tenacity wait_random_exponential max
DELAY_BETWEEN_PAGES = 1.2        # polite crawl delay between paginated requests
MAX_CONCURRENT_BRANDS = 5        # brands scraped in parallel
MAX_IMAGE_WORKERS  = 10          # concurrent image download workers
SHOPIFY_PAGE_LIMIT = 250         # max products per Shopify page request

# ── Browser (Playwright) settings ─────────────────────────────────────────────
BROWSER_HEADLESS   = True
BROWSER_TIMEOUT_MS = 30_000      # ms
PAGE_LOAD_WAIT_MS  = 2_000       # ms – extra wait after navigation

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ── Brand registry ────────────────────────────────────────────────────────────
# key  = internal slug used as folder name and DB identifier
# type = "shopify_api" | "playwright"
BRANDS = {
    "transparent_labs": {
        "display_name": "Transparent Labs",
        "base_url": "https://www.transparentlabs.com",
        "type": "shopify_api",
    },
    "gorilla_mind": {
        "display_name": "Gorilla Mind",
        "base_url": "https://gorillamind.com",
        "type": "shopify_api",
    },
    "raw_nutrition": {
        "display_name": "RAW Nutrition",
        "base_url": "https://www.getrawnutrition.com",
        "type": "shopify_api",
    },
    "cellucor": {
        "display_name": "Cellucor (C4)",
        "base_url": "https://www.cellucor.com",
        "type": "shopify_api",
    },
    "muscletech": {
        "display_name": "MuscleTech",
        "base_url": "https://www.muscletech.com",
        "type": "shopify_api",
    },
    "legion_athletics": {
        "display_name": "Legion Athletics",
        "base_url": "https://legionathletics.com",
        "type": "playwright",
        "collections_url": "https://legionathletics.com/collections/all",
    },
    "optimum_nutrition": {
        "display_name": "Optimum Nutrition",
        "base_url": "https://www.optimumnutrition.com",
        "type": "playwright",
        "collections_url": "https://www.optimumnutrition.com/en-us/Products",
    },
    "dymatize": {
        "display_name": "Dymatize",
        "base_url": "https://www.dymatize.com",
        "type": "playwright",
        "collections_url": "https://www.dymatize.com/collections/all-products",
    },
    "bsn": {
        "display_name": "BSN",
        "base_url": "https://www.bsnsupplements.com",
        "type": "playwright",
        "collections_url": "https://www.bsnsupplements.com/collections/all-products",
    },
    "myprotein": {
        "display_name": "MyProtein",
        "base_url": "https://www.myprotein.com",
        "type": "playwright",
        "collections_url": "https://www.myprotein.com/sports-nutrition/all-products.list",
    },
    "ghost_lifestyle": {
        "display_name": "Ghost Lifestyle",
        "base_url": "https://ghostlifestyle.com",
        "type": "shopify_api",
    },
    "redcon1": {
        "display_name": "Redcon1",
        "base_url": "https://redcon1.com",
        "type": "shopify_api",
    },
    "alpha_lion": {
        "display_name": "Alpha Lion",
        "base_url": "https://alphalion.com",
        "type": "shopify_api",
    },
    "axe_sledge": {
        "display_name": "Axe & Sledge",
        "base_url": "https://axeandsledge.com",
        "type": "shopify_api",
    },
    "five_percent_nutrition": {
        "display_name": "5% Nutrition",
        "base_url": "https://5percentnutrition.com",
        "type": "shopify_api",
    },
    "huge_supplements": {
        "display_name": "Huge Supplements",
        "base_url": "https://hugesupplements.com",
        "type": "shopify_api",
    },
    "jacked_factory": {
        "display_name": "Jacked Factory",
        "base_url": "https://jackedfactory.com",
        "type": "shopify_api",
    },
    "pescience": {
        "display_name": "PEScience",
        "base_url": "https://pescience.com",
        "type": "shopify_api",
    },
    "ryse_supplements": {
        "display_name": "Ryse Supplements",
        "base_url": "https://rysesupps.com",
        "type": "shopify_api",
    },
    "body_science_au": {
        "display_name": "Body Science AU",
        "base_url": "https://www.bodyscience.com.au",
        "type": "shopify_api",
    },
    "musclepharm": {
        "display_name": "MusclePharm",
        "base_url": "https://www.musclepharm.com",
        "type": "shopify_api",
    },
    "body_and_fit": {
        "display_name": "Body and Fit",
        "base_url": "https://www.bodyandfit.com",
        "type": "shopify_retailer",
    },
    "ritual": {
        "display_name": "Ritual",
        "base_url": "https://ritual.com",
        "type": "shopify_api",
    },
    "cymbiotika": {
        "display_name": "Cymbiotika",
        "base_url": "https://cymbiotika.com",
        "type": "shopify_api",
    },
    "hilma": {
        "display_name": "Hilma",
        "base_url": "https://hilma.co",
        "type": "shopify_api",
    },
    "orgain": {
        "display_name": "Orgain",
        "base_url": "https://orgain.com",
        "type": "shopify_api",
    },
    "vega": {
        "display_name": "Vega",
        "base_url": "https://myvega.com",
        "type": "shopify_api",
    },
    "navitas_organics": {
        "display_name": "Navitas Organics",
        "base_url": "https://navitasorganics.com",
        "type": "shopify_api",
    },
    "amazing_grass": {
        "display_name": "Amazing Grass",
        "base_url": "https://www.amazinggrass.com",
        "type": "shopify_api",
    },
    "terrasoul_superfoods": {
        "display_name": "Terrasoul Superfoods",
        "base_url": "https://terrasoul.com",
        "type": "shopify_api",
    },
    "nested_naturals": {
        "display_name": "Nested Naturals",
        "base_url": "https://www.nestednaturals.com",
        "type": "shopify_api",
    },
    "maryruth_organics": {
        "display_name": "MaryRuth Organics",
        "base_url": "https://www.maryruthorganics.com",
        "type": "shopify_api",
    },
    "kos": {
        "display_name": "KOS",
        "base_url": "https://kos.com",
        "type": "shopify_api",
    },
    # ── Recovery & Biohacking ──
    "therabody": {
        "display_name": "Therabody",
        "base_url": "https://www.therabody.com",
        "type": "shopify_api",
    },
    "hyperice": {
        "display_name": "Hyperice",
        "base_url": "https://hyperice.com",
        "type": "shopify_api",
    },
    "compex": {
        "display_name": "Compex",
        "base_url": "https://www.compex.com",
        "type": "shopify_api",
    },
    # ── Functional Foods ──
    "soylent": {
        "display_name": "Soylent",
        "base_url": "https://soylent.com",
        "type": "shopify_api",
    },
    "ample": {
        "display_name": "Ample",
        "base_url": "https://amplemeal.com",
        "type": "shopify_api",
    },
    "owyn": {
        "display_name": "OWYN",
        "base_url": "https://liveowyn.com",
        "type": "shopify_api",
    },
    "true_nutrition": {
        "display_name": "True Nutrition",
        "base_url": "https://www.truenutrition.com",
        "type": "shopify_api",
    },
    # ── Hydration / Electrolytes ──
    "nuun": {
        "display_name": "Nuun",
        "base_url": "https://nuunlife.com",
        "type": "shopify_api",
    },
    "skratch_labs": {
        "display_name": "Skratch Labs",
        "base_url": "https://www.skratchlabs.com",
        "type": "shopify_api",
    },
    "drip_drop": {
        "display_name": "DripDrop",
        "base_url": "https://www.dripdrop.com",
        "type": "shopify_api",
    },
    "key_nutrients": {
        "display_name": "Key Nutrients",
        "base_url": "https://www.keynutrients.com",
        "type": "shopify_api",
    },
    # ── Nootropics ──
    "onnit": {
        "display_name": "Onnit",
        "base_url": "https://www.onnit.com",
        "type": "shopify_api",
    },
    "performance_lab": {
        "display_name": "Performance Lab",
        "base_url": "https://www.performancelab.com",
        "type": "shopify_api",
    },
    "magic_mind": {
        "display_name": "Magic Mind",
        "base_url": "https://www.magicmind.com",
        "type": "shopify_api",
    },
    # ── Longevity / Anti-aging ──
    "elysium": {
        "display_name": "Elysium Health",
        "base_url": "https://www.elysiumhealth.com",
        "type": "shopify_api",
    },
    "tru_niagen": {
        "display_name": "Tru Niagen",
        "base_url": "https://www.truniagen.com",
        "type": "shopify_api",
    },
    "renue_by_science": {
        "display_name": "Renue By Science",
        "base_url": "https://renuebyscience.com",
        "type": "shopify_api",
    },
    # ── Sleep Optimization ──
    "manta_sleep": {
        "display_name": "Manta Sleep",
        "base_url": "https://mantasleep.com",
        "type": "shopify_api",
    },
    "liquid_iv": {
        "display_name": "Liquid I.V.",
        "base_url": "https://www.liquid-iv.com",
        "type": "shopify_hydrogen",
    },
    "novos_labs": {
        "display_name": "NOVOS Labs",
        "base_url": "https://novoslabs.com",
        "type": "woocommerce",
    },
    "vital_proteins":   {"display_name": "Vital Proteins",   "base_url": "https://www.vitalproteins.com",      "type": "shopify_api"},
    "mud_wtr":          {"display_name": "MUD/WTR",         "base_url": "https://mudwtr.com",                 "type": "shopify_api"},
    "four_sigmatic":    {"display_name": "Four Sigmatic",    "base_url": "https://us.foursigmatic.com",        "type": "shopify_api"},
    "bare_performance": {"display_name": "Bare Performance", "base_url": "https://bareperformancenutrition.com","type": "shopify_api"},
    "nutrabio":         {"display_name": "NutraBio",         "base_url": "https://www.nutrabio.com",           "type": "shopify_api"},
    "nuzest":           {"display_name": "Nuzest",           "base_url": "https://www.nuzest-usa.com",         "type": "shopify_api"},
    "primal_kitchen":   {"display_name": "Primal Kitchen",   "base_url": "https://www.primalkitchen.com",      "type": "shopify_api"},
    "momentous":        {"display_name": "Momentous",        "base_url": "https://www.livemomentous.com",      "type": "shopify_api"},
    "bloom_nutrition":  {"display_name": "Bloom Nutrition",  "base_url": "https://bloomnu.com",                "type": "shopify_api"},
    "swolverine":       {"display_name": "Swolverine",       "base_url": "https://swolverine.com",             "type": "shopify_api"},
    "first_phorm":      {"display_name": "1st Phorm",        "base_url": "https://www.1stphorm.com",           "type": "shopify_api"},
    "kaged":            {"display_name": "Kaged",            "base_url": "https://kaged.com",                  "type": "shopify_api"},
    "naked_nutrition":  {"display_name": "Naked Nutrition",  "base_url": "https://nakednutrition.com",         "type": "shopify_api"},
    "olly":             {"display_name": "OLLY",             "base_url": "https://www.olly.com",               "type": "shopify_api"},
    "promix":           {"display_name": "Promix Nutrition", "base_url": "https://promixnutrition.com",        "type": "shopify_api"},

    # ── Premium brands sourced via Swanson Vitamins (retailer-vendor scrape) ──
    # These brands block direct scraping (Cloudflare/Akamai/practitioner-only).
    # Swanson Vitamins exposes a public Shopify products.json that includes
    # complete catalogs from these vendors.
    "garden_of_life":      {"display_name": "Garden of Life",      "base_url": "https://www.swansonvitamins.com", "type": "retailer_vendor_shopify"},
    "thorne":              {"display_name": "Thorne",              "base_url": "https://www.swansonvitamins.com", "type": "retailer_vendor_shopify"},
    "nordic_naturals":     {"display_name": "Nordic Naturals",     "base_url": "https://www.swansonvitamins.com", "type": "retailer_vendor_shopify"},
    "now_foods":           {"display_name": "NOW Foods",           "base_url": "https://www.swansonvitamins.com", "type": "retailer_vendor_shopify"},
    "centrum":             {"display_name": "Centrum",             "base_url": "https://www.swansonvitamins.com", "type": "retailer_vendor_shopify"},
    "pure_encapsulations": {"display_name": "Pure Encapsulations", "base_url": "https://www.swansonvitamins.com", "type": "retailer_vendor_shopify"},

    # ── Retailer fan-out aggregators (their own products are dropped, only matched brands are stored) ──
    "swanson_retailer":         {"display_name": "Swanson Vitamins",        "base_url": "https://www.swansonvitamins.com",       "type": "retailer_vendor_shopify"},
    "the_feed":                 {"display_name": "The Feed",                "base_url": "https://www.thefeed.com",                "type": "retailer_vendor_shopify"},
    "bodybuilding_com":         {"display_name": "Bodybuilding.com",        "base_url": "https://www.bodybuilding.com",           "type": "retailer_vendor_shopify"},
    "supplement_mart_au":       {"display_name": "Supplement Mart AU",      "base_url": "https://supplementmart.com.au",          "type": "retailer_vendor_shopify"},
    "supplement_source_ca":     {"display_name": "Supplement Source CA",    "base_url": "https://supplementsource.ca",            "type": "retailer_vendor_shopify"},
    "discount_supplements_uk":  {"display_name": "Discount Supplements UK", "base_url": "https://www.discount-supplements.co.uk", "type": "retailer_vendor_shopify"},

    # ── Gym accessories & performance gear (Shopify) ──
    "harbinger":           {"display_name": "Harbinger Fitness",   "base_url": "https://www.harbingerfitness.com", "type": "shopify_api"},
    "schiek":              {"display_name": "Schiek Sports",       "base_url": "https://www.schiek.com",          "type": "shopify_api"},
    "bear_komplex":        {"display_name": "Bear KompleX",         "base_url": "https://www.bearkomplex.com",     "type": "shopify_api"},
    "rdx_sports":          {"display_name": "RDX Sports",           "base_url": "https://rdxsports.com",            "type": "shopify_api"},
    "iron_bull_strength":  {"display_name": "Iron Bull Strength",   "base_url": "https://ironbullstrength.com",     "type": "shopify_api"},
    "trx":                 {"display_name": "TRX Training",         "base_url": "https://www.trxtraining.com",      "type": "shopify_api"},

    # ── Premium / iconic brands (mix of direct DTC and retailer fan-out) ──
    "jym":                 {"display_name": "JYM Supplement Science", "base_url": "https://jymsupplementscience.com", "type": "shopify_api"},
    "animal_pak":          {"display_name": "Animal (Universal Nutrition)", "base_url": "https://animalpak.com", "type": "shopify_api"},
    "suppz":               {"display_name": "Suppz",                 "base_url": "https://www.suppz.com",            "type": "retailer_vendor_shopify"},
    # Bucked Up: DTC blocked (Cloudflare/Akamai), aggregated via retailer fan-out vendor matches.
    "bucked_up":           {"display_name": "Bucked Up",             "base_url": "https://www.tigerfitness.com",     "type": "retailer_vendor_shopify"},

    # ── Round 4 expansion: 10 strategic brands across categories ──
    "inno_supps":          {"display_name": "Inno Supps",            "base_url": "https://innosupps.com",            "type": "shopify_api"},
    "quest_nutrition":     {"display_name": "Quest Nutrition",       "base_url": "https://www.questnutrition.com",   "type": "shopify_api"},
    "goli":                {"display_name": "Goli Nutrition",        "base_url": "https://goli.com",                 "type": "shopify_api"},
    "glaxon":              {"display_name": "Glaxon",                "base_url": "https://www.glaxon.com",           "type": "shopify_api"},
    "core_nutritionals":   {"display_name": "Core Nutritionals",     "base_url": "https://corenutritionals.com",     "type": "shopify_api"},
    "black_magic_supps":   {"display_name": "Black Magic Supps",     "base_url": "https://blackmagicsupps.com",      "type": "shopify_api"},
    "codeage":             {"display_name": "Codeage",               "base_url": "https://www.codeage.com",          "type": "shopify_api"},
    "jocko_fuel":          {"display_name": "Jocko Fuel",            "base_url": "https://jockofuel.com",            "type": "shopify_api"},
    "cure_hydration":      {"display_name": "Cure Hydration",        "base_url": "https://www.curehydration.com",    "type": "shopify_api"},
    "nutrex":              {"display_name": "Nutrex Research",       "base_url": "https://nutrex.com",               "type": "shopify_api"},
    "kachava":             {"display_name": "Ka'Chava",              "base_url": "https://kachava.com",              "type": "shopify_api"},
    "truvani":             {"display_name": "Truvani",               "base_url": "https://shop.truvani.com",         "type": "shopify_api"},
    # Retailer-only brands (DTC blocked by Cloudflare/Akamai or Next.js storefront)
    "huel":                {"display_name": "Huel",                  "base_url": "https://www.thefeed.com",          "type": "retailer_vendor_shopify"},
    "lmnt":                {"display_name": "LMNT",                  "base_url": "https://www.thefeed.com",          "type": "retailer_vendor_shopify"},
    "sunwarrior":          {"display_name": "Sunwarrior",            "base_url": "https://supplementmart.com.au",    "type": "retailer_vendor_shopify"},

    # ── Combat sports & athletic gear (Shopify) ──
    "venum":               {"display_name": "Venum",                 "base_url": "https://www.venum.com",            "type": "shopify_api"},
    "hayabusa":            {"display_name": "Hayabusa",              "base_url": "https://hayabusafight.com",        "type": "shopify_api"},
    "fairtex":             {"display_name": "Fairtex",               "base_url": "https://www.fairtex.com",          "type": "shopify_api"},
    "sanabul":             {"display_name": "Sanabul",               "base_url": "https://sanabulsports.com",        "type": "shopify_api"},
    "century_martial_arts": {"display_name": "Century Martial Arts", "base_url": "https://www.centurymartialarts.com", "type": "shopify_api"},
    "fuji_sports":         {"display_name": "Fuji Sports",           "base_url": "https://fujisports.com",           "type": "shopify_api"},
    "everlast":            {"display_name": "Everlast",              "base_url": "https://www.everlast.com",         "type": "shopify_api"},
    "rival_boxing":        {"display_name": "Rival Boxing",          "base_url": "https://rivalboxing.us",           "type": "shopify_api"},
    "shock_doctor":        {"display_name": "Shock Doctor",          "base_url": "https://www.shockdoctor.com",      "type": "shopify_api"},

    # ── Athletic / clean performance lifestyle ──
    "nike":                {"display_name": "Nike",                  "base_url": "https://www.nike.com",             "type": "nike_api"},
    "ten_thousand":        {"display_name": "Ten Thousand",          "base_url": "https://www.tenthousand.cc",       "type": "shopify_api"},
    "allbirds":            {"display_name": "Allbirds",              "base_url": "https://www.allbirds.com",         "type": "shopify_api"},
    "outdoor_voices":      {"display_name": "Outdoor Voices",        "base_url": "https://www.outdoorvoices.com",    "type": "shopify_api"},

    # ── Soccer jerseys, accessories, fan gear, and global kits (US-facing Shopify pricing) ──
    "fifa_store":          {"display_name": "FIFA Official Store",    "base_url": "https://store.fifa.com",           "type": "shopify_api"},
    "soccer_post":         {"display_name": "Soccer Post",            "base_url": "https://soccerpost.com",           "type": "shopify_api"},
    "soccer90":            {"display_name": "Soccer90",               "base_url": "https://soccer90.com",             "type": "shopify_api"},
    "azteca_soccer":       {"display_name": "Azteca Soccer",          "base_url": "https://aztecasoccer.com",         "type": "shopify_api"},
    "soccer_zone_usa":     {"display_name": "Soccer Zone USA",        "base_url": "https://soccerzoneusa.com",        "type": "shopify_api"},
    "football_town":       {"display_name": "Football Town",          "base_url": "https://footballtown.com",         "type": "shopify_api"},
    "away_days":           {"display_name": "Away Days",              "base_url": "https://awaydaysfootball.com",     "type": "shopify_api"},
    "golaco_kits":         {"display_name": "Golaco Kits",            "base_url": "https://golacokits.com",           "type": "shopify_api"},

    # ── Women's health, beauty-from-within, collagen, anti-aging, hormones & gut health ──
    "agent_nateur":        {"display_name": "Agent Nateur",           "base_url": "https://agentnateur.com",          "type": "shopify_api"},
    "moon_juice":          {"display_name": "Moon Juice",             "base_url": "https://www.moonjuice.com",        "type": "shopify_api"},
    "the_nue_co":          {"display_name": "The Nue Co.",            "base_url": "https://www.thenueco.com",         "type": "shopify_api"},
    "jshealth_vitamins":   {"display_name": "JSHealth Vitamins",      "base_url": "https://us.jshealthvitamins.com",  "type": "shopify_api"},
    "needed":              {"display_name": "Needed",                "base_url": "https://thisisneeded.com",         "type": "shopify_api"},
    "perelel":             {"display_name": "Perelel",               "base_url": "https://perelelhealth.com",        "type": "shopify_api"},
    "rae_wellness":        {"display_name": "Rae Wellness",          "base_url": "https://www.raewellness.co",       "type": "shopify_api"},
    "love_wellness":       {"display_name": "Love Wellness",         "base_url": "https://lovewellness.com",         "type": "shopify_api"},
    "o_positiv":           {"display_name": "O Positiv",             "base_url": "https://opositiv.com",             "type": "shopify_api"},
    "winged_wellness":     {"display_name": "Winged Wellness",       "base_url": "https://wingedwellness.com",       "type": "shopify_api"},
    "arrae":               {"display_name": "Arrae",                 "base_url": "https://www.arrae.com",            "type": "shopify_api"},
    "welleco":             {"display_name": "WelleCo",               "base_url": "https://welleco.com",              "type": "shopify_api"},
    "dose_and_co":         {"display_name": "Dose & Co",             "base_url": "https://doseandco.com",            "type": "shopify_api"},
    "further_food":        {"display_name": "Further Food",          "base_url": "https://www.furtherfood.com",      "type": "shopify_api"},
    "beekeepers_naturals": {"display_name": "Beekeeper's Naturals",  "base_url": "https://beekeepersnaturals.com",   "type": "shopify_api"},
    "armra":               {"display_name": "ARMRA",                 "base_url": "https://tryarmra.com",             "type": "shopify_api"},
}