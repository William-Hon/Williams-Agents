import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

DEFAULT_USER_DATA_DIR = os.getenv("CHROME_USER_DATA_DIR", "data/browser_profile")


class BrowserAutomation:
    def __init__(self, user_data_dir: Optional[str] = None, headless: bool = False):
        self.user_data_dir = str(Path(user_data_dir or DEFAULT_USER_DATA_DIR).resolve())
        self.headless = headless
        self.playwright = None
        self.browser_context = None
        self.active_page = None

    async def start(self) -> None:
        """Launch persistent Chrome/Chromium context so user session logins remain active."""
        try:
            from playwright.async_api import async_playwright
            self.playwright = await async_playwright().start()
            Path(self.user_data_dir).mkdir(parents=True, exist_ok=True)
            self.browser_context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=self.user_data_dir,
                headless=self.headless,
                viewport={"width": 1280, "height": 800},
                args=["--disable-blink-features=AutomationControlled"],
            )
            logger.info("Persistent Chrome session initialized in %s", self.user_data_dir)
        except ImportError:
            logger.warning("Playwright is not installed in the current environment.")
        except Exception as e:
            logger.error("Failed to start browser context: %s", e)

    async def open_application(self, url: str):
        if not self.browser_context:
            await self.start()
        if not self.browser_context:
            raise RuntimeError("Browser context could not be started.")

        page = await self.browser_context.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        self.active_page = page
        return page

    async def detect_fields(self, page) -> List[Dict[str, Any]]:
        """Identify form fields, questions, dropdowns, and file upload inputs."""
        fields = []
        inputs = await page.query_selector_all("input, textarea, select")
        for el in inputs:
            tag_name = await el.evaluate("e => e.tagName.toLowerCase()")
            input_type = await el.get_attribute("type") or ""
            name = await el.get_attribute("name") or ""
            input_id = await el.get_attribute("id") or ""
            label_text = ""

            # Attempt to find corresponding label
            if input_id:
                label_el = await page.query_selector(f"label[for='{input_id}']")
                if label_el:
                    label_text = (await label_el.inner_text()).strip()

            if not label_text and name:
                label_text = name

            fields.append({
                "element": el,
                "tag": tag_name,
                "type": input_type,
                "name": name,
                "id": input_id,
                "label": label_text,
            })
        return fields

    async def upload_file(self, page, selector: str, file_path: Path) -> bool:
        """Safely upload tailored resume or cover letter."""
        if not file_path.exists():
            logger.error("File does not exist for upload: %s", file_path)
            return False
        try:
            upload_input = await page.query_selector(selector)
            if upload_input:
                await upload_input.set_input_files(str(file_path.resolve()))
                logger.info("Successfully uploaded %s to %s", file_path.name, selector)
                return True
        except Exception as e:
            logger.error("Upload error on %s: %s", selector, e)
        return False

    async def is_review_page(self, page) -> bool:
        """Check if application reached the final review page."""
        content = (await page.content()).lower()
        review_indicators = [
            "review your application",
            "please review",
            "review and submit",
            "submit application",
            "final review",
        ]
        return any(indicator in content for indicator in review_indicators)

    async def stop(self) -> None:
        if self.browser_context:
            await self.browser_context.close()
        if self.playwright:
            await self.playwright.stop()
