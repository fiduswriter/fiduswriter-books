"""
Selenium tests for the .fidusbook export/import round-trip.

Three test classes cover three scenarios:

BookNativeTest
    Plain (non-E2EE) export and re-import.  Chapter 1 contains an image so
    that the image round-trip is exercised as well.

BookNativeE2EEEnabledTest  (@override_settings E2EE_MODE="enabled")
    The import dialog shows an opt-in checkbox.  The test checks it, imports
    the book, and verifies that every chapter carries a lock icon.

BookNativeE2EERequiredTest  (@override_settings E2EE_MODE="required")
    Encryption is automatic — no checkbox to tick.  Same lock-icon
    verification at the end.
"""

import os
import sys
import time
from tempfile import mkdtemp

from django.conf import settings
from django.test import override_settings
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

# Use the patched variant for E2EE test classes that need @override_settings.
from channels.testing import ChannelsLiveServerTestCase
from testing.channels_patch import (
    ChannelsLiveServerTestCase as ChannelsLiveServerTestCasePatched,
)
from testing.selenium_helper import SeleniumHelper


# ──────────────────────────────────────────────────────────────────────────────
# Shared helpers mixin
# ──────────────────────────────────────────────────────────────────────────────


class BookNativeBase:
    """
    Mixin that provides helpers shared by all three test classes.

    Does not inherit from TestCase — it is mixed in together with
    SeleniumHelper and the appropriate ChannelsLiveServerTestCase subclass.
    """

    # ── Image insertion ───────────────────────────────────────────────────────

    def _insert_image_in_editor(self):
        """
        Insert a figure/image into the currently open document editor.

        The document must already be open.  After this call the document body
        contains a ``<figure>`` node and the cursor is positioned after it.
        The document is NOT closed — the caller is responsible for that.
        """
        image_path = os.path.join(
            settings.PROJECT_PATH, "book/tests/uploads/image.png"
        )

        # Make sure the document body has focus.
        body = WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".doc-body"))
        )
        body.click()

        # Open the Figure dialog via the toolbar "Figure" button.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.XPATH, '//*[@title="Figure"]'))
        ).click()

        # The MathLive field is inserted asynchronously — wait for it before
        # clicking any button inside the dialog.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#figure-dialog span.math-field")
            )
        )
        time.sleep(1)  # Extra margin for MathLive event wiring.

        # Click "Insert image" inside the figure dialog.
        self.driver.find_element(By.ID, "insert-figure-image").click()

        # Open the image upload form.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.XPATH, '//*[normalize-space()="Add new image"]')
            )
        ).click()

        # Supply the local file path to the hidden file input.
        upload_input = WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.XPATH, '//*[@id="editimage"]/div[1]/input[2]')
            )
        )
        upload_input.send_keys(image_path)

        # Submit the upload.
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class,"ui-button") and normalize-space()="Upload"]',
        ).click()

        # Wait for the upload to complete (check-mark row appears).
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".fw-data-table i.fa-check")
            )
        )

        # Confirm image selection.
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Use image"]'
        ).click()

        # Close the figure dialog.
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()

        # Verify the figure node is present in the document body.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".doc-body figure")
            )
        )

    # ── Passphrase-key bootstrap ──────────────────────────────────────────────

    def _setup_passphrase_keys(self):
        """
        Generate real ECDH + AES-GCM keys in the browser, create a
        UserEncryptionKey record in the database for the test user, and
        inject the master key and private key into sessionStorage so that
        subsequent E2EE document operations proceed without prompts.
        """
        from user.models import UserEncryptionKey

        # Navigate to the correct origin first so that sessionStorage is set
        # for the right domain.
        self.driver.get(self.base_url)
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".new_document button")
            )
        )

        keys = self.driver.execute_script(
            """
            return (async function() {
                const keyPair = await crypto.subtle.generateKey(
                    {name: "ECDH", namedCurve: "P-256"},
                    true,
                    ["deriveKey"]
                );
                const masterKey = await crypto.subtle.generateKey(
                    {name: "AES-GCM", length: 256},
                    true,
                    ["encrypt", "decrypt"]
                );
                const publicJwk  = await crypto.subtle.exportKey(
                    "jwk", keyPair.publicKey);
                const privateJwk = await crypto.subtle.exportKey(
                    "jwk", keyPair.privateKey);
                const masterRaw  = await crypto.subtle.exportKey(
                    "raw", masterKey);
                const masterBase64 = btoa(
                    String.fromCharCode(...new Uint8Array(masterRaw)));
                return {
                    publicJwk:       JSON.stringify(publicJwk),
                    privateJwk:      JSON.stringify(privateJwk),
                    masterKeyBase64: masterBase64
                };
            })();
            """
        )

        UserEncryptionKey.objects.create(
            user=self.user,
            public_key=keys["publicJwk"],
            encrypted_master_key="dummy_encrypted_mk",
            encrypted_private_key="dummy_encrypted_sk",
            user_salt=b"1234567890123456",
            user_iterations=600000,
            encrypted_master_key_backup="dummy_backup",
        )

        self.driver.execute_script(
            "sessionStorage.setItem('e2ee_master_key', arguments[0]);"
            "sessionStorage.setItem('e2ee_private_key', arguments[1]);",
            keys["masterKeyBase64"],
            keys["privateJwk"],
        )


# ──────────────────────────────────────────────────────────────────────────────
# Class-level boilerplate shared by all three concrete test classes.
# Factored out here to avoid copy-paste; each class calls super().
# ──────────────────────────────────────────────────────────────────────────────


def _make_setUpClass(cls):
    """Call from each concrete setUpClass after super().setUpClass()."""
    cls.base_url = cls.live_server_url
    cls.download_dir = mkdtemp()
    driver_data = cls.get_drivers(1, cls.download_dir)
    cls.driver = driver_data["drivers"][0]
    cls.client = driver_data["clients"][0]
    cls.driver.implicitly_wait(driver_data["wait_time"])
    cls.wait_time = driver_data["wait_time"]


def _make_tearDownClass(cls):
    """Call from each concrete tearDownClass before super().tearDownClass()."""
    cls.driver.quit()
    # Remove any files left by a test that failed before its own cleanup so
    # that os.rmdir does not raise.
    for fname in os.listdir(cls.download_dir):
        try:
            os.remove(os.path.join(cls.download_dir, fname))
        except OSError:
            pass
    try:
        os.rmdir(cls.download_dir)
    except OSError:
        pass


# ──────────────────────────────────────────────────────────────────────────────
# Test 1 – plain (non-E2EE) round-trip
# ──────────────────────────────────────────────────────────────────────────────


class BookNativeTest(
    BookNativeBase, SeleniumHelper, ChannelsLiveServerTestCase
):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
        "initial_book_data.json",
    ]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        _make_setUpClass(cls)

    @classmethod
    def tearDownClass(cls):
        _make_tearDownClass(cls)
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )

    def tearDown(self):
        super().tearDown()
        if "coverage" in sys.modules.keys():
            time.sleep(self.wait_time / 3)

    def test_fidusbook_export_import(self):
        """
        Export a book (Chapter 1 contains an image) as .fidusbook, delete
        everything, re-import and verify that the book and its chapter
        documents — including the image — are fully restored.
        """
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")

        # ── Create "Chapter 1" document (with image) ─────────────────────────
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
        self._insert_image_in_editor()
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()

        # ── Create "Chapter 2" document (text only) ───────────────────────────
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

        # ── Navigate to Books ─────────────────────────────────────────────────
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/books/"]')
            )
        ).click()

        # ── Create book "Test Book" with both chapters ────────────────────────
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

        # ── Export as .fidusbook via the bulk action menu ─────────────────────
        self.driver.find_element(
            By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Export selected as Fidusbook"]'
        ).click()
        # Allow time for the ZIP to be assembled (image fetch included).
        time.sleep(3)
        fidusbook_path = os.path.join(self.download_dir, "test-book.fidusbook")
        self.assertTrue(
            os.path.isfile(fidusbook_path),
            "Expected test-book.fidusbook to be downloaded",
        )

        # ── Delete the book ───────────────────────────────────────────────────
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

        # ── Delete the chapter documents from the document list ───────────────
        self.driver.get(self.base_url + "/")
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".fw-contents tbody tr")
            )
        )
        # Delete first document.
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
        # Delete second (now the only remaining) document.
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

        # ── Import the .fidusbook file ────────────────────────────────────────
        self.driver.get(self.base_url + "/books/")
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    'button[title="Import book from Fidusbook file (Alt-i)"]',
                )
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "fidusbook-uploader"))
        )
        self.driver.find_element(By.ID, "fidusbook-uploader").send_keys(
            fidusbook_path
        )
        # There is no E2EE checkbox in the plain mode — just click Import.
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()

        # ── Wait for import to complete ───────────────────────────────────────
        # Multiple server round-trips (doc create + image upload × 1 +
        # doc save + book save) — use a generous timeout.
        WebDriverWait(self.driver, self.wait_time * 3).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".book-title"))
        )

        # ── Verify book is restored ───────────────────────────────────────────
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

        # ── Verify chapter documents are restored via the book dialog ─────────
        self.driver.find_element(By.CSS_SELECTOR, ".book-title").click()
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()
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
        self.assertTrue(
            any("Chapter 1" in t for t in chapter_texts),
            f"Chapter 1 not found in chapter list: {chapter_texts}",
        )
        self.assertTrue(
            any("Chapter 2" in t for t in chapter_texts),
            f"Chapter 2 not found in chapter list: {chapter_texts}",
        )

        # ── Clean up downloaded file ──────────────────────────────────────────
        os.remove(fidusbook_path)


# ──────────────────────────────────────────────────────────────────────────────
# Shared E2EE test body
# Used by both BookNativeE2EEEnabledTest and BookNativeE2EERequiredTest.
# ──────────────────────────────────────────────────────────────────────────────


def _run_e2ee_import_test(self, *, tick_checkbox):
    """
    Core of the E2EE export/import round-trip test.

    Parameters
    ----------
    tick_checkbox : bool
        True  → "enabled" mode: the import dialog shows an opt-in checkbox
                 that we must check before clicking Import.
        False → "required" mode: encryption is automatic; no checkbox.
    """
    # ── Bootstrap passphrase keys so server-side password persistence works ──
    self._setup_passphrase_keys()

    # ── Create "Chapter 1" document (with image) ──────────────────────────────
    self.driver.get(self.base_url + "/")
    WebDriverWait(self.driver, self.wait_time).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, ".new_document button"))
    ).click()
    if tick_checkbox:
        # Wait for and interact with encryption choice dialog
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".ui-dialog"))
        )
        # Select "Encrypted" radio button
        self.driver.find_element(By.ID, "e2ee").click()
        # Click "Create"
        self.driver.find_element(
            By.CSS_SELECTOR, ".ui-dialog .fw-dark"
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
    self._insert_image_in_editor()
    time.sleep(1)
    self.driver.find_element(By.ID, "close-document-top").click()

    # ── Create "Chapter 2" document (text only) ───────────────────────────────
    WebDriverWait(self.driver, self.wait_time).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, ".new_document button"))
    ).click()
    if tick_checkbox:
        # Wait for and interact with encryption choice dialog
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".ui-dialog"))
        )
        # Select "Non-encrypted" radio button
        self.driver.find_element(By.ID, "nonencrypted").click()
        # Click "Create"
        self.driver.find_element(
            By.CSS_SELECTOR, ".ui-dialog .fw-dark"
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

    # ── Navigate to Books ─────────────────────────────────────────────────────
    WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href="/books/"]'))
    ).click()

    # Wait for the async document list to be populated so the book dialog
    # shows the user's documents when it is opened.
    WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, 'button[title="Create new book (Alt-n)"]')
        )
    )
    WebDriverWait(self.driver, self.wait_time).until(
        lambda d: d.execute_script(
            "return !!("
            "  window.theApp &&"
            "  window.theApp.page &&"
            "  window.theApp.page.documentList &&"
            "  window.theApp.page.documentList.length > 0"
            ")"
        )
    )

    # ── Create book "Test Book" with both chapters ────────────────────────────
    WebDriverWait(self.driver, self.wait_time).until(
        EC.element_to_be_clickable(
            (
                By.CSS_SELECTOR,
                'button[title="Create new book (Alt-n)"]',
            )
        )
    ).click()
    self.driver.find_element(By.ID, "book-title").send_keys("Test Book")
    self.driver.find_element(By.CSS_SELECTOR, 'a[href="#optionTab1"]').click()
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
    WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".book-title"))
    )
    self.assertEqual(
        self.driver.find_element(By.CSS_SELECTOR, ".book-title").text,
        "Test Book",
    )

    # ── Export as .fidusbook ──────────────────────────────────────────────────
    self.driver.find_element(
        By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
    ).click()
    WebDriverWait(self.driver, self.wait_time).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
    ).click()
    self.driver.find_element(
        By.XPATH, '//*[normalize-space()="Export selected as Fidusbook"]'
    ).click()
    time.sleep(3)
    fidusbook_path = os.path.join(self.download_dir, "test-book.fidusbook")
    self.assertTrue(
        os.path.isfile(fidusbook_path),
        "Expected test-book.fidusbook to be downloaded",
    )

    # ── Delete the book ───────────────────────────────────────────────────────
    self.driver.refresh()
    self.driver.find_element(By.CSS_SELECTOR, ".delete-book i").click()
    self.driver.find_element(
        By.XPATH, '//*[normalize-space()="Delete"]'
    ).click()
    time.sleep(1)
    self.assertEqual(
        len(self.driver.find_elements(By.CSS_SELECTOR, ".book-title")), 0
    )

    # ── Delete both chapter documents ─────────────────────────────────────────
    self.driver.get(self.base_url + "/")
    WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, ".fw-contents tbody tr")
        )
    )
    for _ in range(2):
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
    # ── Import the .fidusbook file ────────────────────────────────────────────
    self.driver.get(self.base_url + "/books/")
    WebDriverWait(self.driver, self.wait_time).until(
        EC.element_to_be_clickable(
            (
                By.CSS_SELECTOR,
                'button[title="Import book from Fidusbook file (Alt-i)"]',
            )
        )
    ).click()
    WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located((By.ID, "fidusbook-uploader"))
    )
    self.driver.find_element(By.ID, "fidusbook-uploader").send_keys(
        fidusbook_path
    )

    if tick_checkbox:
        # "enabled" mode: opt-in checkbox must be checked before Import.
        self.driver.find_element(By.ID, "fidusbook-import-e2ee").click()

    self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()

    # ── Wait for import ───────────────────────────────────────────────────────
    # Extra time: E2EE key generation + image encryption + passphrase save.
    WebDriverWait(self.driver, self.wait_time * 4).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".book-title"))
    )

    # ── Verify book is restored ───────────────────────────────────────────────
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

    # ── Verify chapters have E2EE lock icons ──────────────────────────────────
    self.driver.find_element(By.CSS_SELECTOR, ".book-title").click()
    self.driver.find_element(By.CSS_SELECTOR, 'a[href="#optionTab1"]').click()
    WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, "#book-chapter-list tr")
        )
    )

    # Both chapters must carry a lock icon.
    lock_icons = self.driver.find_elements(
        By.CSS_SELECTOR, "#book-chapter-list tr .e2ee-chapter-icon"
    )
    self.assertEqual(
        len(lock_icons),
        2,
        "Both imported chapters should have an E2EE lock icon",
    )

    # The encrypted-chapters notice must appear below the chapter list.
    notice = WebDriverWait(self.driver, self.wait_time).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, ".e2ee-chapter-notice")
        )
    )
    self.assertIn("encrypted chapters", notice.text.lower())

    # ── Clean up downloaded file ──────────────────────────────────────────────
    os.remove(fidusbook_path)


# ──────────────────────────────────────────────────────────────────────────────
# Test 2 – E2EE "enabled" mode (opt-in checkbox)
# ──────────────────────────────────────────────────────────────────────────────


@override_settings(E2EE_MODE="enabled")
class BookNativeE2EEEnabledTest(
    BookNativeBase, SeleniumHelper, ChannelsLiveServerTestCasePatched
):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
        "initial_book_data.json",
    ]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        _make_setUpClass(cls)

    @classmethod
    def tearDownClass(cls):
        _make_tearDownClass(cls)
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )
        self.login_user(self.user, self.driver, self.client)
        return super().setUp()

    def tearDown(self):
        self.driver.execute_script("window.localStorage.clear()")
        self.driver.execute_script("window.sessionStorage.clear()")
        super().tearDown()
        if "coverage" in sys.modules.keys():
            time.sleep(self.wait_time / 3)

    def test_fidusbook_export_import_e2ee(self):
        """
        Export/import round-trip with E2EE_MODE="enabled".

        The import dialog shows an opt-in checkbox.  The test ticks it so
        chapters are imported as E2EE documents, then verifies that lock
        icons appear on every chapter in the restored book.
        """
        _run_e2ee_import_test(self, tick_checkbox=True)


# ──────────────────────────────────────────────────────────────────────────────
# Test 3 – E2EE "required" mode (automatic encryption)
# ──────────────────────────────────────────────────────────────────────────────


@override_settings(E2EE_MODE="required")
class BookNativeE2EERequiredTest(
    BookNativeBase, SeleniumHelper, ChannelsLiveServerTestCasePatched
):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
        "initial_book_data.json",
    ]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        _make_setUpClass(cls)

    @classmethod
    def tearDownClass(cls):
        _make_tearDownClass(cls)
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )
        self.login_user(self.user, self.driver, self.client)
        return super().setUp()

    def tearDown(self):
        self.driver.execute_script("window.localStorage.clear()")
        self.driver.execute_script("window.sessionStorage.clear()")
        super().tearDown()
        if "coverage" in sys.modules.keys():
            time.sleep(self.wait_time / 3)

    def test_fidusbook_export_import_e2ee(self):
        """
        Export/import round-trip with E2EE_MODE="required".

        Encryption is automatic — the import dialog shows only a note, no
        checkbox.  All chapters are imported as E2EE documents and the test
        verifies that lock icons appear on every chapter.
        """
        _run_e2ee_import_test(self, tick_checkbox=False)
