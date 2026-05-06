"""Storefront taxonomy and merchandising priorities.

The storefront should sell health first: supplements, vitamins, wellness goals,
and beauty-from-within. Apparel, soccer, fight gear, and accessories stay in the
catalog, but they are intentionally secondary in navigation and merchandising.
"""

PRIMARY_DEPARTMENTS = [
    {
        "slug": "supplements",
        "name": "Supplements",
        "primary": True,
        "priority": 10,
        "description": "Core powders, capsules, amino acids, performance formulas, and daily supplement staples.",
    },
    {
        "slug": "vitamins_health",
        "name": "Vitamins & Health",
        "primary": True,
        "priority": 20,
        "description": "Daily vitamins, minerals, omegas, immune support, joint support, and foundational health products.",
    },
    {
        "slug": "wellness_goals",
        "name": "Shop By Goal",
        "primary": True,
        "priority": 30,
        "description": "Goal-led shopping for gut health, sleep, stress, focus, energy, weight management, and recovery.",
    },
    {
        "slug": "womens_wellness",
        "name": "Women's Wellness",
        "primary": True,
        "priority": 40,
        "description": "Collagen, beauty-from-within, hair/skin/nails, hormone support, prenatal, postnatal, and menopause support.",
    },
    {
        "slug": "sports_nutrition",
        "name": "Sports Nutrition",
        "primary": True,
        "priority": 50,
        "description": "Protein, pre-workout, creatine, hydration, recovery, and gym performance nutrition.",
    },
    {
        "slug": "functional_foods",
        "name": "Functional Foods & Drinks",
        "primary": True,
        "priority": 60,
        "description": "Meal replacements, protein bars, RTD shakes, functional beverages, snacks, and wellness foods.",
    },
    {
        "slug": "wellness_devices",
        "name": "Recovery & Wellness Devices",
        "primary": False,
        "priority": 70,
        "description": "Recovery tools, sleep gear, wearables, massage devices, and wellness hardware.",
    },
    {
        "slug": "sports_gear",
        "name": "Sports Gear & Soccer",
        "primary": False,
        "priority": 80,
        "description": "Soccer jerseys, cleats, balls, fan gear, fight gear, training gear, and sport accessories.",
    },
    {
        "slug": "apparel_accessories",
        "name": "Apparel & Accessories",
        "primary": False,
        "priority": 90,
        "description": "Lifestyle apparel, shoes, hats, bottles, bags, merch, and non-health accessories.",
    },
    {
        "slug": "other",
        "name": "Other",
        "primary": False,
        "priority": 99,
        "description": "Products that need manual review or do not fit the primary store taxonomy yet.",
    },
]


COLLECTIONS = {
    "supplements": [
        {"slug": "all_supplements", "name": "All Supplements", "priority": 10},
        {"slug": "pre_workout", "name": "Pre-Workout", "priority": 20},
        {"slug": "creatine", "name": "Creatine", "priority": 30},
        {"slug": "amino_acids", "name": "BCAA / EAA / Aminos", "priority": 40},
        {"slug": "greens_superfoods", "name": "Greens & Superfoods", "priority": 50},
        {"slug": "adaptogens_herbals", "name": "Adaptogens & Herbals", "priority": 60},
    ],
    "vitamins_health": [
        {"slug": "multivitamins", "name": "Multivitamins", "priority": 10},
        {"slug": "vitamins_minerals", "name": "Vitamins & Minerals", "priority": 20},
        {"slug": "omega_fish_oil", "name": "Omega & Fish Oil", "priority": 30},
        {"slug": "joint_support", "name": "Joint Support", "priority": 40},
        {"slug": "immune_support", "name": "Immune Support", "priority": 50},
    ],
    "wellness_goals": [
        {"slug": "gut_health", "name": "Gut Health", "priority": 10},
        {"slug": "sleep_stress", "name": "Sleep & Stress", "priority": 20},
        {"slug": "focus_mood", "name": "Focus & Mood", "priority": 30},
        {"slug": "energy_hydration", "name": "Energy & Hydration", "priority": 40},
        {"slug": "weight_management", "name": "Weight Management", "priority": 50},
        {"slug": "longevity", "name": "Longevity", "priority": 60},
    ],
    "womens_wellness": [
        {"slug": "collagen_beauty", "name": "Collagen & Beauty", "priority": 10},
        {"slug": "hair_skin_nails", "name": "Hair, Skin & Nails", "priority": 20},
        {"slug": "hormone_support", "name": "Hormone Support", "priority": 30},
        {"slug": "prenatal_postnatal", "name": "Prenatal & Postnatal", "priority": 40},
        {"slug": "menopause", "name": "Perimenopause & Menopause", "priority": 50},
    ],
    "sports_nutrition": [
        {"slug": "protein", "name": "Protein", "priority": 10},
        {"slug": "pre_workout", "name": "Pre-Workout", "priority": 20},
        {"slug": "creatine", "name": "Creatine", "priority": 30},
        {"slug": "hydration", "name": "Hydration", "priority": 40},
        {"slug": "recovery", "name": "Recovery", "priority": 50},
        {"slug": "mass_gainers", "name": "Mass Gainers", "priority": 60},
    ],
    "functional_foods": [
        {"slug": "meal_replacement", "name": "Meal Replacement", "priority": 10},
        {"slug": "protein_bars", "name": "Protein Bars", "priority": 20},
        {"slug": "rtd_shakes", "name": "RTD Shakes", "priority": 30},
        {"slug": "snacks", "name": "Snacks", "priority": 40},
        {"slug": "functional_drinks", "name": "Functional Drinks", "priority": 50},
    ],
    "wellness_devices": [
        {"slug": "recovery_devices", "name": "Recovery Devices", "priority": 10},
        {"slug": "sleep_gear", "name": "Sleep Gear", "priority": 20},
        {"slug": "wearables", "name": "Wearables", "priority": 30},
    ],
    "sports_gear": [
        {"slug": "soccer_jerseys", "name": "Soccer Jerseys", "priority": 10},
        {"slug": "soccer_cleats", "name": "Soccer Cleats & Shoes", "priority": 20},
        {"slug": "soccer_accessories", "name": "Soccer Accessories", "priority": 30},
        {"slug": "fight_gear", "name": "Fight Gear", "priority": 40},
        {"slug": "training_gear", "name": "Training Gear", "priority": 50},
    ],
    "apparel_accessories": [
        {"slug": "apparel", "name": "Apparel", "priority": 10},
        {"slug": "shoes", "name": "Shoes", "priority": 20},
        {"slug": "bags_bottles", "name": "Bags & Bottles", "priority": 30},
        {"slug": "merch", "name": "Merch", "priority": 40},
    ],
    "other": [
        {"slug": "needs_review", "name": "Needs Review", "priority": 10},
    ],
}


SOCCER_BRANDS = {
    "fifa_store",
    "soccer_post",
    "soccer90",
    "azteca_soccer",
    "soccer_zone_usa",
    "football_town",
    "away_days",
    "golaco_kits",
}

APPAREL_FIRST_BRANDS = {
    "allbirds",
    "nike",
    "outdoor_voices",
    "ten_thousand",
}

FIGHT_GEAR_BRANDS = {
    "venum",
    "hayabusa",
    "fairtex",
    "sanabul",
    "rdx_sports",
    "century_martial_arts",
    "fuji_sports",
    "everlast",
    "rival_boxing",
    "shock_doctor",
}

WOMENS_WELLNESS_BRANDS = {
    "agent_nateur",
    "moon_juice",
    "the_nue_co",
    "jshealth_vitamins",
    "needed",
    "perelel",
    "rae_wellness",
    "love_wellness",
    "o_positiv",
    "winged_wellness",
    "arrae",
    "welleco",
    "dose_and_co",
    "further_food",
    "beekeepers_naturals",
    "armra",
}

TOP_NAVIGATION = [
    "supplements",
    "vitamins_health",
    "wellness_goals",
    "womens_wellness",
    "sports_nutrition",
    "functional_foods",
    "wellness_devices",
    "sports_gear",
    "apparel_accessories",
]

HOMEPAGE_SECTIONS = [
    {"slug": "top_supplements", "title": "Top Supplements", "department": "supplements"},
    {"slug": "daily_health", "title": "Daily Vitamins & Health", "department": "vitamins_health"},
    {"slug": "womens_wellness", "title": "Women's Wellness", "department": "womens_wellness"},
    {"slug": "gut_sleep_energy", "title": "Gut, Sleep & Energy", "department": "wellness_goals"},
    {"slug": "protein_performance", "title": "Protein & Performance", "department": "sports_nutrition"},
    {"slug": "functional_foods", "title": "Functional Foods & Drinks", "department": "functional_foods"},
    {"slug": "soccer_fan_shop", "title": "Soccer Fan Shop", "department": "sports_gear"},
    {"slug": "apparel_accessories", "title": "Apparel & Accessories", "department": "apparel_accessories"},
]