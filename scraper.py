#!/usr/bin/env python3
"""
Arenda.az Real Estate Scraper
Robust scraper with crash recovery and data persistence
"""

import asyncio
import aiohttp
from aiohttp import ClientSession, ClientTimeout, TCPConnector
from bs4 import BeautifulSoup
import csv
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime
import re
from urllib.parse import urljoin, urlparse
import signal
import sys
from dataclasses import dataclass, asdict
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class Listing:
    """Data class for real estate listing"""
    listing_id: str = ""
    url: str = ""
    title: str = ""
    property_type: str = ""
    price: str = ""
    price_azn: str = ""
    location: str = ""
    address: str = ""
    rooms: str = ""
    area: str = ""
    floor: str = ""
    total_floors: str = ""
    description: str = ""
    features: str = ""  # Comma-separated features
    agent_name: str = ""
    phone: str = ""
    date_posted: str = ""
    listing_code: str = ""
    view_count: str = ""
    has_document: str = ""
    is_credit_available: str = ""
    latitude: str = ""
    longitude: str = ""
    scraped_at: str = ""


class ScraperState:
    """Manages scraper state for crash recovery"""

    def __init__(self, state_file: str = "scraper_state.json"):
        self.state_file = Path(state_file)
        self.state = self._load_state()

    def _load_state(self) -> Dict:
        """Load state from file"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading state: {e}")
                return self._initial_state()
        return self._initial_state()

    def _initial_state(self) -> Dict:
        """Create initial state"""
        return {
            'last_page': 0,
            'processed_listings': [],
            'failed_listings': [],
            'total_scraped': 0,
            'last_update': None
        }

    def save(self):
        """Save state to file"""
        try:
            self.state['last_update'] = datetime.now().isoformat()
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self.state, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving state: {e}")

    def add_processed(self, listing_id: str):
        """Mark listing as processed"""
        if listing_id not in self.state['processed_listings']:
            self.state['processed_listings'].append(listing_id)
            self.state['total_scraped'] += 1
            self.save()

    def add_failed(self, listing_id: str, url: str):
        """Mark listing as failed"""
        failed_entry = {'id': listing_id, 'url': url, 'time': datetime.now().isoformat()}
        self.state['failed_listings'].append(failed_entry)
        self.save()

    def is_processed(self, listing_id: str) -> bool:
        """Check if listing already processed"""
        return listing_id in self.state['processed_listings']

    def set_last_page(self, page: int):
        """Update last processed page"""
        self.state['last_page'] = page
        self.save()


class CSVWriter:
    """Thread-safe CSV writer with buffering"""

    def __init__(self, filename: str = "arenda_listings.csv"):
        self.filename = Path(filename)
        self.lock = asyncio.Lock()
        self._initialize_file()

    def _initialize_file(self):
        """Initialize CSV file with headers"""
        if not self.filename.exists():
            try:
                with open(self.filename, 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=self._get_headers())
                    writer.writeheader()
            except Exception as e:
                logger.error(f"Error initializing CSV: {e}")

    def _get_headers(self) -> List[str]:
        """Get CSV headers"""
        return [field.name for field in Listing.__dataclass_fields__.values()]

    async def write_row(self, listing: Listing):
        """Write a single row to CSV"""
        async with self.lock:
            try:
                with open(self.filename, 'a', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=self._get_headers())
                    writer.writerow(asdict(listing))
            except Exception as e:
                logger.error(f"Error writing to CSV: {e}")
                raise

    async def write_rows(self, listings: List[Listing]):
        """Write multiple rows to CSV"""
        async with self.lock:
            try:
                with open(self.filename, 'a', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=self._get_headers())
                    for listing in listings:
                        writer.writerow(asdict(listing))
            except Exception as e:
                logger.error(f"Error writing rows to CSV: {e}")
                raise


class ArendaScraper:
    """Main scraper class"""

    def __init__(self, base_url: str = "https://arenda.az", max_concurrent: int = 5):
        self.base_url = base_url
        self.max_concurrent = max_concurrent
        self.state = ScraperState()
        self.csv_writer = CSVWriter()
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.session: Optional[ClientSession] = None
        self.running = True

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False

    async def _create_session(self) -> ClientSession:
        """Create aiohttp session with optimal settings"""
        timeout = ClientTimeout(total=30, connect=10)
        connector = TCPConnector(
            limit=100,
            limit_per_host=10,
            ttl_dns_cache=300,
            enable_cleanup_closed=True
        )
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'az,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        return ClientSession(timeout=timeout, connector=connector, headers=headers)

    async def _fetch_with_retry(self, url: str, max_retries: int = 3) -> Optional[str]:
        """Fetch URL with retry logic"""
        for attempt in range(max_retries):
            try:
                async with self.semaphore:
                    async with self.session.get(url) as response:
                        if response.status == 200:
                            return await response.text()
                        elif response.status == 404:
                            logger.warning(f"Page not found: {url}")
                            return None
                        else:
                            logger.warning(f"HTTP {response.status} for {url}")
            except asyncio.TimeoutError:
                logger.warning(f"Timeout for {url}, attempt {attempt + 1}/{max_retries}")
            except Exception as e:
                logger.error(f"Error fetching {url}: {e}, attempt {attempt + 1}/{max_retries}")

            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

        return None

    def _extract_listing_links(self, html: str) -> List[tuple]:
        """Extract listing links from page"""
        soup = BeautifulSoup(html, 'html.parser')
        listings = []

        for li in soup.find_all('li', class_='new_elan_box'):
            listing_id = li.get('id', '').replace('elan_', '')
            link = li.find('a', href=True)

            if link and listing_id:
                url = urljoin(self.base_url, link['href'])
                listings.append((listing_id, url))

        return listings

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        if not text:
            return ""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _extract_number(self, text: str) -> str:
        """Extract number from text"""
        if not text:
            return ""
        match = re.search(r'[\d\s]+', text)
        return match.group().strip() if match else ""

    async def _parse_listing_detail(self, html: str, url: str) -> Optional[Listing]:
        """Parse listing detail page"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            listing = Listing()

            # Extract listing ID from URL
            listing.url = url
            listing.listing_id = url.split('-')[-1] if '-' in url else ""
            listing.scraped_at = datetime.now().isoformat()

            # Property type and title
            title_elem = soup.find('h2', class_='elan_in_title_link')
            if title_elem:
                listing.property_type = self._clean_text(title_elem.get_text())

            # Full title from elan_elan_nov
            full_title = soup.find('p', class_='elan_elan_nov')
            if full_title:
                listing.title = self._clean_text(full_title.get_text())

            # Price
            price_elem = soup.find('span', class_='elan_price_new')
            if price_elem:
                price_text = self._clean_text(price_elem.get_text())
                listing.price = price_text
                listing.price_azn = self._extract_number(price_text)

            # Location/Address
            location_elem = soup.find('p', class_='elan_unvan')
            if location_elem:
                listing.location = self._clean_text(location_elem.get_text())

            address_elem = soup.find('span', class_='elan_unvan_txt')
            if address_elem:
                listing.address = self._clean_text(address_elem.get_text())

            # Properties (rooms, area, floor)
            property_list = soup.find('ul', class_='elan_property_list')
            if property_list:
                props = property_list.find_all('li')
                for prop in props:
                    text = self._clean_text(prop.get_text())
                    if 'otaq' in text:
                        listing.rooms = self._extract_number(text)
                    elif 'm2' in text or 'm²' in text:
                        listing.area = self._extract_number(text)
                    elif 'mərtəbə' in text:
                        floor_match = re.search(r'(\d+)\s*/\s*(\d+)', text)
                        if floor_match:
                            listing.floor = floor_match.group(1)
                            listing.total_floors = floor_match.group(2)

            # Description
            desc_elem = soup.find('div', class_='elan_info_txt')
            if desc_elem:
                desc_p = desc_elem.find('p')
                if desc_p:
                    listing.description = self._clean_text(desc_p.get_text())

            # Features
            features_list = []
            property_lists = soup.find('ul', class_='property_lists')
            if property_lists:
                features = property_lists.find_all('li')
                for feature in features:
                    # Extract text after SVG icon
                    feature_text = self._clean_text(feature.get_text())
                    if feature_text:
                        features_list.append(feature_text)
            listing.features = ', '.join(features_list)

            # Agent info
            agent_info = soup.find('div', class_='new_elan_user_info')
            if agent_info:
                agent_name = agent_info.find('p')
                if agent_name:
                    listing.agent_name = self._clean_text(agent_name.get_text())

                # Phone number
                phone_link = agent_info.find('a', class_='elan_in_tel')
                if phone_link:
                    listing.phone = self._clean_text(phone_link.get_text())

            # Date, code, views
            date_box = soup.find('div', class_='elan_date_box')
            if date_box:
                paragraphs = date_box.find_all('p')
                for p in paragraphs:
                    text = self._clean_text(p.get_text())
                    if 'Elanın tarixi:' in text:
                        listing.date_posted = text.replace('Elanın tarixi:', '').strip()
                    elif 'Elanın kodu:' in text:
                        listing.listing_code = text.replace('Elanın kodu:', '').strip()
                    elif 'Baxış sayı:' in text:
                        listing.view_count = text.replace('Baxış sayı:', '').strip()

            # Document status
            kupca_icon = soup.find('button', class_='kupca_ico')
            listing.has_document = 'Bəli' if kupca_icon else 'Xeyr'

            # Credit availability
            credit_icon = soup.find('button', class_='kreditle_ico')
            listing.is_credit_available = 'Bəli' if credit_icon else 'Xeyr'

            # Coordinates
            lat_input = soup.find('input', {'name': 'lat'})
            lon_input = soup.find('input', {'name': 'lon'})
            if lat_input and lat_input.get('value'):
                listing.latitude = lat_input['value']
            if lon_input and lon_input.get('value'):
                listing.longitude = lon_input['value']

            return listing

        except Exception as e:
            logger.error(f"Error parsing listing detail: {e}")
            return None

    async def _scrape_listing(self, listing_id: str, url: str) -> Optional[Listing]:
        """Scrape a single listing"""
        if self.state.is_processed(listing_id):
            logger.info(f"Skipping already processed listing: {listing_id}")
            return None

        try:
            logger.info(f"Scraping listing {listing_id}: {url}")
            html = await self._fetch_with_retry(url)

            if not html:
                logger.error(f"Failed to fetch listing {listing_id}")
                self.state.add_failed(listing_id, url)
                return None

            listing = await self._parse_listing_detail(html, url)

            if listing:
                # Save to CSV immediately
                await self.csv_writer.write_row(listing)
                self.state.add_processed(listing_id)
                logger.info(f"Successfully scraped listing {listing_id}")
                return listing
            else:
                logger.error(f"Failed to parse listing {listing_id}")
                self.state.add_failed(listing_id, url)
                return None

        except Exception as e:
            logger.error(f"Error scraping listing {listing_id}: {e}")
            self.state.add_failed(listing_id, url)
            return None

    async def _scrape_page(self, page: int) -> List[Listing]:
        """Scrape all listings from a page"""
        if not self.running:
            return []

        # Construct page URL
        url = f"{self.base_url}/filtirli-axtaris/{page}/?home_search=1&lang=1&site=1&home_s=1"
        logger.info(f"Scraping page {page}: {url}")

        html = await self._fetch_with_retry(url)
        if not html:
            logger.error(f"Failed to fetch page {page}")
            return []

        # Extract listing links
        listing_links = self._extract_listing_links(html)
        logger.info(f"Found {len(listing_links)} listings on page {page}")

        if not listing_links:
            logger.warning(f"No listings found on page {page}")
            return []

        # Scrape all listings concurrently
        tasks = [
            self._scrape_listing(listing_id, listing_url)
            for listing_id, listing_url in listing_links
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out None results and exceptions
        listings = [r for r in results if isinstance(r, Listing)]

        self.state.set_last_page(page)
        logger.info(f"Completed page {page}: {len(listings)}/{len(listing_links)} successful")

        return listings

    def _get_max_page(self, html: str) -> int:
        """Extract maximum page number from pagination"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            pagination = soup.find('ul', class_='pagination')
            if pagination:
                page_links = pagination.find_all('a', class_='page-numbers')
                pages = []
                for link in page_links:
                    text = link.get_text().strip()
                    if text.isdigit():
                        pages.append(int(text))
                return max(pages) if pages else 1
        except Exception as e:
            logger.error(f"Error extracting max page: {e}")
        return 1

    async def scrape(self, start_page: int = 1, end_page: Optional[int] = None):
        """Main scraping method"""
        try:
            self.session = await self._create_session()

            # Resume from last page if available
            if self.state.state['last_page'] > 0:
                start_page = self.state.state['last_page']
                logger.info(f"Resuming from page {start_page}")

            # Determine end page if not specified
            if end_page is None:
                first_page_html = await self._fetch_with_retry(
                    f"{self.base_url}/filtirli-axtaris/1/?home_search=1&lang=1&site=1&home_s=1"
                )
                if first_page_html:
                    end_page = self._get_max_page(first_page_html)
                    logger.info(f"Detected {end_page} total pages")
                else:
                    logger.error("Could not determine total pages, defaulting to 10")
                    end_page = 10

            logger.info(f"Starting scrape from page {start_page} to {end_page}")

            # Scrape pages
            for page in range(start_page, end_page + 1):
                if not self.running:
                    logger.info("Scraper stopped by user")
                    break

                try:
                    await self._scrape_page(page)
                    # Small delay between pages to be respectful
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error scraping page {page}: {e}")
                    continue

            logger.info(f"Scraping completed. Total listings: {self.state.state['total_scraped']}")
            logger.info(f"Failed listings: {len(self.state.state['failed_listings'])}")

        except Exception as e:
            logger.error(f"Critical error in scraper: {e}")
        finally:
            if self.session:
                await self.session.close()
            logger.info("Session closed")


async def main():
    """Main entry point"""
    # Configuration
    START_PAGE = 1
    END_PAGE = None  # Set to None to scrape all pages, or specify a number
    MAX_CONCURRENT = 5  # Number of concurrent requests

    logger.info("=" * 80)
    logger.info("Arenda.az Real Estate Scraper")
    logger.info("=" * 80)

    scraper = ArendaScraper(max_concurrent=MAX_CONCURRENT)

    try:
        await scraper.scrape(start_page=START_PAGE, end_page=END_PAGE)
    except KeyboardInterrupt:
        logger.info("Scraper interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        logger.info("Scraper finished")


if __name__ == "__main__":
    asyncio.run(main())
