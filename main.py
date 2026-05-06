#!/usr/bin/env python3
"""
Sups Scraper – Multi-brand supplement product data collector.

Usage
─────
  # Scrape ALL 10 brands
  python main.py

  # Scrape specific brands only
  python main.py --brands transparent_labs gorilla_mind

  # Scrape + download images
  python main.py --images

  # Export to CSV/JSON after scraping
  python main.py --export

  # Full run: scrape + images + export
  python main.py --images --export

  # Skip scraping, just export existing DB
  python main.py --skip-scrape --export

  # Show counts per brand from existing DB
  python main.py --stats
"""
import argparse
import asyncio
import os
import sys
from typing import Dict, List, Optional, Type

from rich.console import Console
from rich.table import Table

# ── project root on path ──────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from config import BRANDS, IMAGES_DIR, MAX_CONCURRENT_BRANDS, OUTPUT_DIR
from scrapers.base import BaseScraper
from scrapers.brands.transparent_labs import TransparentLabsScraper
from scrapers.brands.gorilla_mind     import GorillaMindScraper
from scrapers.brands.raw_nutrition    import RawNutritionScraper
from scrapers.brands.cellucor         import CellucorScraper
from scrapers.brands.muscletech       import MuscleTechScraper
from scrapers.brands.legion_athletics import LegionAthleticsScraper
from scrapers.brands.optimum_nutrition import OptimumNutritionScraper
from scrapers.brands.dymatize         import DymatizeScraper
from scrapers.brands.bsn              import BSNScraper
from scrapers.brands.myprotein        import MyProteinScraper
from scrapers.brands.tiger_fitness    import TigerFitnessScraper
from scrapers.brands.supplement_warehouse import SupplementWarehouseScraper
from scrapers.brands.nutrition_warehouse_au import NutritionWarehouseScraper
from scrapers.brands.supplement_hunt  import SupplementHuntScraper
from scrapers.brands.nz_muscle        import NZMuscleScraper
from scrapers.brands.ghost_lifestyle  import GhostLifestyleScraper
from scrapers.brands.redcon1          import Redcon1Scraper
from scrapers.brands.alpha_lion       import AlphaLionScraper
from scrapers.brands.axe_sledge       import AxeSledgeScraper
from scrapers.brands.five_percent_nutrition import FivePercentNutritionScraper
from scrapers.brands.huge_supplements import HugeSupplementsScraper
from scrapers.brands.jacked_factory   import JackedFactoryScraper
from scrapers.brands.pescience        import PescienceScraper
from scrapers.brands.ryse_supplements import RyseSupplementsScraper
from scrapers.brands.body_science_au  import BodyScienceAuScraper
from scrapers.brands.musclepharm      import MusclePharmScraper
from scrapers.brands.body_and_fit     import BodyAndFitScraper
from scrapers.brands.ritual           import RitualScraper
from scrapers.brands.cymbiotika       import CymbiotikaScraper
from scrapers.brands.hilma            import HilmaScraper
from scrapers.brands.orgain           import OrgainScraper
from scrapers.brands.vega             import VegaScraper
from scrapers.brands.navitas_organics import NavitasOrganicsScraper
from scrapers.brands.amazing_grass    import AmazingGrassScraper
from scrapers.brands.terrasoul_superfoods import TerrasoulSuperfoodsScraper
from scrapers.brands.nested_naturals  import NestedNaturalsScraper
from scrapers.brands.maryruth_organics import MaryruthOrganicsScraper
from scrapers.brands.kos              import KosScraper
from scrapers.brands.therabody        import TherabodyScraper
from scrapers.brands.hyperice         import HypericeScraper
from scrapers.brands.compex           import CompexScraper
from scrapers.brands.soylent          import SoylentScraper
from scrapers.brands.ample            import AmpleScraper
from scrapers.brands.owyn             import OwynScraper
from scrapers.brands.true_nutrition   import TrueNutritionScraper
from scrapers.brands.nuun             import NuunScraper
from scrapers.brands.skratch_labs     import SkratchLabsScraper
from scrapers.brands.drip_drop        import DripDropScraper
from scrapers.brands.key_nutrients    import KeyNutrientsScraper
from scrapers.brands.onnit            import OnnitScraper
from scrapers.brands.performance_lab  import PerformanceLabScraper
from scrapers.brands.magic_mind       import MagicMindScraper
from scrapers.brands.elysium          import ElysiumScraper
from scrapers.brands.tru_niagen       import TruNiagenScraper
from scrapers.brands.renue_by_science import RenueByScienceScraper
from scrapers.brands.manta_sleep      import MantaSleepScraper
from scrapers.brands.liquid_iv        import LiquidIVScraper
from scrapers.brands.novos_labs       import NovosLabsScraper
from scrapers.brands.vital_proteins   import VitalProteinsScraper
from scrapers.brands.mud_wtr          import MudWtrScraper
from scrapers.brands.four_sigmatic    import FourSigmaticScraper
from scrapers.brands.bare_performance import BarePerformanceScraper
from scrapers.brands.nutrabio         import NutrabioScraper
from scrapers.brands.nuzest           import NuzestScraper
from scrapers.brands.primal_kitchen   import PrimalKitchenScraper
from scrapers.brands.momentous        import MomentousScraper
from scrapers.brands.bloom_nutrition  import BloomNutritionScraper
from scrapers.brands.swolverine       import SwolverineScraper
from scrapers.brands.first_phorm      import FirstPhormScraper
from scrapers.brands.kaged            import KagedScraper
from scrapers.brands.naked_nutrition  import NakedNutritionScraper
from scrapers.brands.olly             import OllyScraper
from scrapers.brands.promix           import PromixScraper
from scrapers.brands.swanson_retailer import SwansonRetailerScraper
from scrapers.brands.the_feed         import TheFeedScraper
from scrapers.brands.bodybuilding_com import BodybuildingComScraper
from scrapers.brands.supplement_mart_au   import SupplementMartAuScraper
from scrapers.brands.supplement_source_ca import SupplementSourceCaScraper
from scrapers.brands.discount_supplements_uk import DiscountSupplementsUkScraper
from scrapers.brands.harbinger        import HarbingerScraper
from scrapers.brands.schiek           import SchiekScraper
from scrapers.brands.bear_komplex     import BearKomplexScraper
from scrapers.brands.rdx_sports       import RdxSportsScraper
from scrapers.brands.iron_bull_strength import IronBullStrengthScraper
from scrapers.brands.trx              import TrxScraper
from scrapers.brands.jym              import JymScraper
from scrapers.brands.animal_pak       import AnimalPakScraper
from scrapers.brands.suppz            import SuppzScraper
from scrapers.brands.inno_supps       import InnoSuppsScraper
from scrapers.brands.quest_nutrition  import QuestNutritionScraper
from scrapers.brands.goli             import GoliScraper
from scrapers.brands.glaxon           import GlaxonScraper
from scrapers.brands.core_nutritionals import CoreNutritionalsScraper
from scrapers.brands.black_magic_supps import BlackMagicSuppsScraper
from scrapers.brands.codeage          import CodeageScraper
from scrapers.brands.jocko_fuel       import JockoFuelScraper
from scrapers.brands.cure_hydration   import CureHydrationScraper
from scrapers.brands.nutrex           import NutrexScraper
from scrapers.brands.kachava          import KachavaScraper
from scrapers.brands.truvani          import TruvaniScraper
from scrapers.brands.venum            import VenumScraper
from scrapers.brands.hayabusa         import HayabusaScraper
from scrapers.brands.fairtex          import FairtexScraper
from scrapers.brands.sanabul          import SanabulScraper
from scrapers.brands.century_martial_arts import CenturyMartialArtsScraper
from scrapers.brands.fuji_sports      import FujiSportsScraper
from scrapers.brands.everlast         import EverlastScraper
from scrapers.brands.rival_boxing     import RivalBoxingScraper
from scrapers.brands.shock_doctor     import ShockDoctorScraper
from scrapers.brands.nike             import NikeScraper
from scrapers.brands.ten_thousand     import TenThousandScraper
from scrapers.brands.allbirds         import AllbirdsScraper
from scrapers.brands.outdoor_voices   import OutdoorVoicesScraper
from scrapers.brands.fifa_store       import FifaStoreScraper
from scrapers.brands.soccer_post      import SoccerPostScraper
from scrapers.brands.soccer90         import Soccer90Scraper
from scrapers.brands.azteca_soccer    import AztecaSoccerScraper
from scrapers.brands.soccer_zone_usa  import SoccerZoneUsaScraper
from scrapers.brands.football_town    import FootballTownScraper
from scrapers.brands.away_days        import AwayDaysScraper
from scrapers.brands.golaco_kits      import GolacoKitsScraper
from scrapers.brands.agent_nateur     import AgentNateurScraper
from scrapers.brands.moon_juice       import MoonJuiceScraper
from scrapers.brands.the_nue_co       import TheNueCoScraper
from scrapers.brands.jshealth_vitamins import JshealthVitaminsScraper
from scrapers.brands.needed           import NeededScraper
from scrapers.brands.perelel          import PerelelScraper
from scrapers.brands.rae_wellness     import RaeWellnessScraper
from scrapers.brands.love_wellness    import LoveWellnessScraper
from scrapers.brands.o_positiv        import OPositivScraper
from scrapers.brands.winged_wellness  import WingedWellnessScraper
from scrapers.brands.arrae            import ArraeScraper
from scrapers.brands.welleco          import WellecoScraper
from scrapers.brands.dose_and_co      import DoseAndCoScraper
from scrapers.brands.further_food     import FurtherFoodScraper
from scrapers.brands.beekeepers_naturals import BeekeepersNaturalsScraper
from scrapers.brands.armra            import ArmraScraper
from utils.downloader import download_all_images_for_brand
from utils.logger   import get_logger
from utils.storage  import export_to_csv, export_to_json, get_counts, init_db

console = Console()
log     = get_logger("main")

# ── brand → scraper class mapping ─────────────────────────────────────────────
SCRAPER_MAP: Dict[str, Type[BaseScraper]] = {
    "transparent_labs":  TransparentLabsScraper,
    "gorilla_mind":      GorillaMindScraper,
    "raw_nutrition":     RawNutritionScraper,
    "cellucor":          CellucorScraper,
    "muscletech":        MuscleTechScraper,
    "legion_athletics":  LegionAthleticsScraper,
    "optimum_nutrition": OptimumNutritionScraper,
    "dymatize":          DymatizeScraper,
    "bsn":               BSNScraper,
    "myprotein":         MyProteinScraper,
    "tiger_fitness":          TigerFitnessScraper,
    "supplement_warehouse":   SupplementWarehouseScraper,
    "nutrition_warehouse_au": NutritionWarehouseScraper,
    "supplement_hunt":        SupplementHuntScraper,
    "nz_muscle":              NZMuscleScraper,
    "ghost_lifestyle":        GhostLifestyleScraper,
    "redcon1":                Redcon1Scraper,
    "alpha_lion":             AlphaLionScraper,
    "axe_sledge":             AxeSledgeScraper,
    "five_percent_nutrition": FivePercentNutritionScraper,
    "huge_supplements":       HugeSupplementsScraper,
    "jacked_factory":         JackedFactoryScraper,
    "pescience":              PescienceScraper,
    "ryse_supplements":       RyseSupplementsScraper,
    "body_science_au":        BodyScienceAuScraper,
    "musclepharm":            MusclePharmScraper,
    "body_and_fit":           BodyAndFitScraper,
    "ritual":                 RitualScraper,
    "cymbiotika":             CymbiotikaScraper,
    "hilma":                  HilmaScraper,
    "orgain":                 OrgainScraper,
    "vega":                   VegaScraper,
    "navitas_organics":       NavitasOrganicsScraper,
    "amazing_grass":          AmazingGrassScraper,
    "terrasoul_superfoods":   TerrasoulSuperfoodsScraper,
    "nested_naturals":        NestedNaturalsScraper,
    "maryruth_organics":      MaryruthOrganicsScraper,
    "kos":                    KosScraper,
    "therabody":              TherabodyScraper,
    "hyperice":               HypericeScraper,
    "compex":                 CompexScraper,
    "soylent":                SoylentScraper,
    "ample":                  AmpleScraper,
    "owyn":                   OwynScraper,
    "true_nutrition":         TrueNutritionScraper,
    "nuun":                   NuunScraper,
    "skratch_labs":           SkratchLabsScraper,
    "drip_drop":              DripDropScraper,
    "key_nutrients":          KeyNutrientsScraper,
    "onnit":                  OnnitScraper,
    "performance_lab":        PerformanceLabScraper,
    "magic_mind":             MagicMindScraper,
    "elysium":                ElysiumScraper,
    "tru_niagen":             TruNiagenScraper,
    "renue_by_science":       RenueByScienceScraper,
    "manta_sleep":            MantaSleepScraper,
    "liquid_iv":              LiquidIVScraper,
    "novos_labs":             NovosLabsScraper,
    "vital_proteins":         VitalProteinsScraper,
    "mud_wtr":                MudWtrScraper,
    "four_sigmatic":          FourSigmaticScraper,
    "bare_performance":       BarePerformanceScraper,
    "nutrabio":               NutrabioScraper,
    "nuzest":                 NuzestScraper,
    "primal_kitchen":         PrimalKitchenScraper,
    "momentous":              MomentousScraper,
    "bloom_nutrition":        BloomNutritionScraper,
    "swolverine":             SwolverineScraper,
    "first_phorm":            FirstPhormScraper,
    "kaged":                  KagedScraper,
    "naked_nutrition":        NakedNutritionScraper,
    "olly":                   OllyScraper,
    "promix":                 PromixScraper,
    "swanson_retailer":       SwansonRetailerScraper,
    "the_feed":               TheFeedScraper,
    "bodybuilding_com":       BodybuildingComScraper,
    "supplement_mart_au":     SupplementMartAuScraper,
    "supplement_source_ca":   SupplementSourceCaScraper,
    "discount_supplements_uk": DiscountSupplementsUkScraper,
    "harbinger":              HarbingerScraper,
    "schiek":                 SchiekScraper,
    "bear_komplex":           BearKomplexScraper,
    "rdx_sports":             RdxSportsScraper,
    "iron_bull_strength":     IronBullStrengthScraper,
    "trx":                    TrxScraper,
    "jym":                    JymScraper,
    "animal_pak":             AnimalPakScraper,
    "suppz":                  SuppzScraper,
    "inno_supps":             InnoSuppsScraper,
    "quest_nutrition":        QuestNutritionScraper,
    "goli":                   GoliScraper,
    "glaxon":                 GlaxonScraper,
    "core_nutritionals":      CoreNutritionalsScraper,
    "black_magic_supps":      BlackMagicSuppsScraper,
    "codeage":                CodeageScraper,
    "jocko_fuel":             JockoFuelScraper,
    "cure_hydration":         CureHydrationScraper,
    "nutrex":                 NutrexScraper,
    "kachava":                KachavaScraper,
    "truvani":                TruvaniScraper,
    "venum":                  VenumScraper,
    "hayabusa":               HayabusaScraper,
    "fairtex":                FairtexScraper,
    "sanabul":                SanabulScraper,
    "century_martial_arts":   CenturyMartialArtsScraper,
    "fuji_sports":            FujiSportsScraper,
    "everlast":               EverlastScraper,
    "rival_boxing":           RivalBoxingScraper,
    "shock_doctor":           ShockDoctorScraper,
    "nike":                   NikeScraper,
    "ten_thousand":           TenThousandScraper,
    "allbirds":               AllbirdsScraper,
    "outdoor_voices":         OutdoorVoicesScraper,
    "fifa_store":             FifaStoreScraper,
    "soccer_post":            SoccerPostScraper,
    "soccer90":               Soccer90Scraper,
    "azteca_soccer":          AztecaSoccerScraper,
    "soccer_zone_usa":        SoccerZoneUsaScraper,
    "football_town":          FootballTownScraper,
    "away_days":              AwayDaysScraper,
    "golaco_kits":            GolacoKitsScraper,
    "agent_nateur":           AgentNateurScraper,
    "moon_juice":             MoonJuiceScraper,
    "the_nue_co":             TheNueCoScraper,
    "jshealth_vitamins":      JshealthVitaminsScraper,
    "needed":                 NeededScraper,
    "perelel":                PerelelScraper,
    "rae_wellness":           RaeWellnessScraper,
    "love_wellness":          LoveWellnessScraper,
    "o_positiv":              OPositivScraper,
    "winged_wellness":        WingedWellnessScraper,
    "arrae":                  ArraeScraper,
    "welleco":                WellecoScraper,
    "dose_and_co":            DoseAndCoScraper,
    "further_food":           FurtherFoodScraper,
    "beekeepers_naturals":    BeekeepersNaturalsScraper,
    "armra":                  ArmraScraper,
}


# ── helpers ────────────────────────────────────────────────────────────────────

def _print_stats() -> None:
    counts = get_counts()
    if not counts:
        console.print("[yellow]No products in database yet.[/yellow]")
        return
    tbl = Table(title="Products in DB", show_lines=True)
    tbl.add_column("Brand", style="cyan")
    tbl.add_column("Products", justify="right", style="green")
    total = 0
    for brand, cnt in sorted(counts.items()):
        tbl.add_row(BRANDS.get(brand, {}).get("display_name", brand), str(cnt))
        total += cnt
    tbl.add_row("[bold]TOTAL[/bold]", f"[bold]{total}[/bold]")
    console.print(tbl)


async def _run_brand(slug: str, download_images: bool) -> List[Dict]:
    scraper_cls = SCRAPER_MAP.get(slug)
    if not scraper_cls:
        log.error("No scraper registered for: %s", slug)
        return []

    scraper  = scraper_cls()
    products = await scraper.run()

    if download_images and products:
        log.info("Downloading images for %s (%d products)…", slug, len(products))
        await download_all_images_for_brand(slug, products)

    return products


async def _run_all(brand_slugs: List[str], download_images: bool) -> None:
    """Run scrapers concurrently up to MAX_CONCURRENT_BRANDS at a time."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_BRANDS)

    async def bounded(slug: str) -> None:
        async with semaphore:
            await _run_brand(slug, download_images)

    await asyncio.gather(*[bounded(slug) for slug in brand_slugs])


# ── CLI ────────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sups – supplement product scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--brands", nargs="+", metavar="SLUG",
        choices=list(SCRAPER_MAP.keys()),
        help="Brand slugs to scrape (default: all)",
    )
    parser.add_argument(
        "--images", action="store_true",
        help="Download product images after scraping",
    )
    parser.add_argument(
        "--export", action="store_true",
        help="Export results to CSV + JSON after scraping",
    )
    parser.add_argument(
        "--skip-scrape", action="store_true",
        help="Skip scraping; only run export/stats",
    )
    parser.add_argument(
        "--stats", action="store_true",
        help="Print per-brand product counts and exit",
    )
    return parser.parse_args()


async def main() -> None:
    args = _parse_args()

    # Ensure output directories exist
    for d in (OUTPUT_DIR, IMAGES_DIR):
        os.makedirs(d, exist_ok=True)

    # Initialise DB
    init_db()

    if args.stats:
        _print_stats()
        return

    brand_slugs = args.brands or list(SCRAPER_MAP.keys())
    console.rule(f"[bold blue]Sups Scraper – {len(brand_slugs)} brand(s)[/bold blue]")

    if not args.skip_scrape:
        await _run_all(brand_slugs, download_images=args.images)

    if args.export:
        console.rule("[bold]Exporting data[/bold]")
        export_to_json()
        export_to_csv()
        for slug in brand_slugs:
            export_to_json(slug)
            export_to_csv(slug)

    console.rule("[bold green]All done[/bold green]")
    _print_stats()


if __name__ == "__main__":
    asyncio.run(main())
