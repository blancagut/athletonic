"""Abstract base class for all brand scrapers."""
import asyncio
from abc import ABC, abstractmethod
from typing import Any, Dict, List

from utils.logger import get_logger
from utils.storage import upsert_product


class BaseScraper(ABC):
    """
    Contract every brand scraper must fulfil.

    Subclasses implement `scrape()` and yield product dicts
    conforming to the standard schema defined in storage.py.
    """

    brand_slug: str = ""        # e.g. "transparent_labs"
    display_name: str = ""      # e.g. "Transparent Labs"
    base_url: str = ""

    def __init__(self) -> None:
        self.log = get_logger(self.brand_slug or self.__class__.__name__)

    @abstractmethod
    async def scrape(self) -> List[Dict[str, Any]]:
        """
        Scrape all products and return them as a list of dicts.
        Each dict must include at minimum:
            brand, product_id, name, price, images
        """

    async def run(self) -> List[Dict[str, Any]]:
        """Scrape + persist every product to the database."""
        self.log.info("[bold cyan]Starting[/bold cyan] %s …", self.display_name)
        products = await self.scrape()
        saved = 0
        for product in products:
            product.setdefault("brand", self.brand_slug)
            try:
                upsert_product(product)
                saved += 1
            except Exception as exc:
                self.log.error("DB error for %s / %s: %s", self.brand_slug, product.get("name"), exc)
        self.log.info(
            "[bold green]Done[/bold green] %s – %d products saved",
            self.display_name,
            saved,
        )
        return products
