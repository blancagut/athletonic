"""Async image downloader with deduplication and progress tracking."""
import asyncio
import hashlib
import os
import re
import ssl
from typing import Dict, List, Optional
from urllib.parse import urlparse

import aiofiles
import aiohttp
import certifi

from config import IMAGES_DIR, MAX_IMAGE_WORKERS, REQUEST_TIMEOUT, USER_AGENT
from utils.logger import get_logger
from utils.storage import update_image_local_path

log = get_logger(__name__)

_SEEN: set = set()          # in-memory dedup of downloaded URLs
_SEMAPHORE: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    global _SEMAPHORE
    if _SEMAPHORE is None:
        _SEMAPHORE = asyncio.Semaphore(MAX_IMAGE_WORKERS)
    return _SEMAPHORE


def _safe_filename(url: str) -> str:
    """Derive a filesystem-safe filename from an image URL."""
    parsed = urlparse(url)
    name   = os.path.basename(parsed.path)
    # strip Shopify CDN query params e.g. ?v=12345
    name   = re.sub(r'\?.*$', '', name)
    # sanitise
    name   = re.sub(r'[^\w.\-]', '_', name)
    return name or hashlib.md5(url.encode()).hexdigest() + ".jpg"


async def _download_one(
    session: aiohttp.ClientSession,
    brand: str,
    product_id: str,
    handle: str,
    img: Dict,
) -> Optional[str]:
    url = img.get("url", "")
    if not url or url in _SEEN:
        return img.get("local_path")

    ssl_ctx  = ssl.create_default_context(cafile=certifi.where())
    sem      = _get_semaphore()
    brand_dir = os.path.join(IMAGES_DIR, brand, handle)
    os.makedirs(brand_dir, exist_ok=True)

    filename   = _safe_filename(url)
    local_path = os.path.join(brand_dir, filename)

    if os.path.exists(local_path):
        _SEEN.add(url)
        update_image_local_path(brand, product_id, url, local_path)
        return local_path

    async with sem:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT), ssl=ssl_ctx) as resp:
                if resp.status == 200:
                    content = await resp.read()
                    async with aiofiles.open(local_path, "wb") as f:
                        await f.write(content)
                    _SEEN.add(url)
                    update_image_local_path(brand, product_id, url, local_path)
                    log.debug("Downloaded %s → %s", url, local_path)
                    return local_path
                else:
                    log.warning("Image %s returned HTTP %s", url, resp.status)
        except Exception as exc:
            log.warning("Failed to download %s: %s", url, exc)

    return None


async def download_product_images(
    brand: str,
    product_id: str,
    handle: str,
    images: List[Dict],
) -> List[Dict]:
    """Download all images for a product and return updated image list."""
    headers = {"User-Agent": USER_AGENT}
    async with aiohttp.ClientSession(headers=headers) as session:
        tasks = [
            _download_one(session, brand, product_id, handle, img)
            for img in images
        ]
        paths = await asyncio.gather(*tasks)

    for img, path in zip(images, paths):
        if path:
            img["local_path"] = path

    return images


async def download_all_images_for_brand(brand: str, products: List[Dict]) -> None:
    """Batch download images for an entire brand's product list."""
    headers = {"User-Agent": USER_AGENT}
    async with aiohttp.ClientSession(headers=headers) as session:
        all_tasks = []
        for product in products:
            for img in product.get("images", []):
                all_tasks.append(
                    _download_one(
                        session,
                        brand,
                        str(product["product_id"]),
                        product.get("handle", str(product["product_id"])),
                        img,
                    )
                )
        if all_tasks:
            await asyncio.gather(*all_tasks)
