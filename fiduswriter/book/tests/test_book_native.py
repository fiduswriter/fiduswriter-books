"""
Selenium test for the .fidusbook export/import round-trip.

Scenario
--------
1. Create two chapter documents with some content.
2. Create a book ("Test Book") containing both chapters.
3. Export the book as a .fidusbook file via the bulk action menu.
4. Delete the book from the book list.
5. Delete both chapter documents from the document list.
6. Import the saved .fidusbook file via the import menu.
7. Verify that the book and both chapter documents have been restored.
"""

import os
import sys
import time
from tempfile import mkdtemp

from channels.testing import ChannelsLiveServerTestCase
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from testing.selenium_helper import SeleniumHelper


class BookNativeTest(SeleniumHelper, ChannelsLiveServerTestCase):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
        "initial_book_data.json",
    ]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.base_url = cls.live_server_url
        cls.download_dir = mkdtemp()
        driver_data = cls.get_drivers(1, cls.download_dir)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        os.rmdir(cls.download_dir)
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )

    def tearDown(self):
        super().tearDown()
        if "coverage" in sys.modules.keys():
            # Cool down between tests when collecting coverage data.
            time.sleep(self.wait_time / 3)

    def test_fidusbook_export_import(self):
        """Export a book as .fidusbook, delete everything, re-import and
        verify that the book and its chapter documents are fully restored."""
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")

        # ── Create "Chapter 1" document ──────────────────────────────────────
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            "Chapter 1"
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").send_keys(
            "Content of chapter one."
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()

        # ── Create "Chapter 2" document ──────────────────────────────────────
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            "Chapter 2"
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").send_keys(
            "Content of chapter two."
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()

        # ── Navigate to Books ────────────────────────────────────────────────
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/books/"]')
            )
        ).click()

        # ── Create book "Test Book" with both chapters ───────────────────────
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    'button[title="Create new book (Alt-n)"]',
                )
            )
        ).click()
        self.driver.find_element(By.ID, "book-title").send_keys("Test Book")
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()
        # Select both documents from the document list on the left
        self.driver.find_element(
            By.CSS_SELECTOR, "#book-document-list .file .file-name"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#book-document-list .file:nth-child(2) .file-name",
        ).click()
        self.driver.find_element(By.ID, "add-chapter").click()
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements(By.CSS_SELECTOR, ".book-title")), 1
        )
        self.assertEqual(
            self.driver.find_element(By.CSS_SELECTOR, ".book-title").text,
            "Test Book",
        )

        # ── Export as .fidusbook via the bulk action menu ────────────────────
        self.driver.find_element(
            By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Export selected as Fidusbook"]'
        ).click()
        # Allow time for the ZIP to be assembled and downloaded.
        time.sleep(3)
        fidusbook_path = os.path.join(self.download_dir, "test-book.fidusbook")
        self.assertTrue(
            os.path.isfile(fidusbook_path),
            "Expected test-book.fidusbook to be downloaded",
        )

        # ── Delete the book ──────────────────────────────────────────────────
        self.driver.refresh()
        self.driver.find_element(By.CSS_SELECTOR, ".delete-book i").click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Delete"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements(By.CSS_SELECTOR, ".book-title")),
            0,
            "Book should have been deleted",
        )

        # ── Delete the chapter documents from the document list ──────────────
        self.driver.get(self.base_url + "/")
        # Wait until at least one document row is visible.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".fw-contents tbody tr")
            )
        )
        # Delete first document (select + bulk-delete).
        self.driver.find_element(
            By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Delete selected"]'
        ).click()
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()
        time.sleep(1)
        # Delete second document (now the only remaining row).
        self.driver.find_element(
            By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Delete selected"]'
        ).click()
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()
        time.sleep(1)

        # ── Import the .fidusbook file ───────────────────────────────────────
        self.driver.get(self.base_url + "/books/")
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    'button[title="Import book from Fidusbook file (Alt-i)"]',
                )
            )
        ).click()
        # Wait for the import dialog to open and its file input to be present.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "fidusbook-uploader"))
        )
        self.driver.find_element(By.ID, "fidusbook-uploader").send_keys(
            fidusbook_path
        )
        # Click the "Import" button (the dark-themed confirm button).
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()

        # Wait for the import to complete and the book list to refresh.
        # This involves several server round-trips, so we use a generous
        # timeout (3× the standard wait_time).
        WebDriverWait(self.driver, self.wait_time * 3).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".book-title"))
        )

        # ── Verify book is restored ──────────────────────────────────────────
        self.assertEqual(
            len(self.driver.find_elements(By.CSS_SELECTOR, ".book-title")),
            1,
            "Exactly one book should exist after import",
        )
        self.assertEqual(
            self.driver.find_element(By.CSS_SELECTOR, ".book-title").text,
            "Test Book",
            "Restored book should have the original title",
        )

        # ── Verify chapter documents are restored via the book dialog ────────
        # Open the book dialog to inspect chapters.
        self.driver.find_element(By.CSS_SELECTOR, ".book-title").click()
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()
        # Wait for the chapter list to populate.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#book-chapter-list tr")
            )
        )
        chapter_items = self.driver.find_elements(
            By.CSS_SELECTOR,
            "#book-chapter-list tr .fw-inline:not(.delete-chapter)",
        )
        self.assertEqual(
            len(chapter_items),
            2,
            "Restored book should have exactly 2 chapters",
        )
        chapter_texts = [item.text for item in chapter_items]
        # Each entry reads "N Title" where N is the chapter number.
        self.assertTrue(
            any("Chapter 1" in t for t in chapter_texts),
            f"Chapter 1 not found in chapter list: {chapter_texts}",
        )
        self.assertTrue(
            any("Chapter 2" in t for t in chapter_texts),
            f"Chapter 2 not found in chapter list: {chapter_texts}",
        )

        # ── Clean up downloaded file ─────────────────────────────────────────
        os.remove(fidusbook_path)
