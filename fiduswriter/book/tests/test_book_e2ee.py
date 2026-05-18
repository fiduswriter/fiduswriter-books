"""
Selenium tests for books that contain E2EE encrypted chapters.

Covers:
  - Lock icon and encrypted-chapter notice appear in the book dialog when a
    chapter is an E2EE document.
  - Sanity check succeeds when the passphrase is already unlocked in the
    session, even when the chapter includes an encrypted image (stored in
    EncryptedDocumentImage, not the regular UserImage model).
  - Sanity check fails gracefully and reports an appropriate error when the
    passphrase session keys are absent (e.g. fresh session / after log-out).
"""

import os
import sys
import time
import zipfile
from tempfile import mkdtemp

from django.conf import settings
from django.test import override_settings
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from testing.channels_patch import ChannelsLiveServerTestCase
from testing.selenium_helper import SeleniumHelper


@override_settings(E2EE_MODE="enabled")
class BookE2EETest(SeleniumHelper, ChannelsLiveServerTestCase):
    """
    End-to-end tests for books whose chapters are E2EE encrypted.

    Each test method is self-contained: it sets up its own passphrase keys,
    creates the E2EE documents it needs, builds a book, and then asserts on
    the behaviour under test.
    """

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
        # Clean up any leftover downloads so os.rmdir succeeds even if a
        # test failed before removing its own files.
        for fname in os.listdir(cls.download_dir):
            try:
                os.remove(os.path.join(cls.download_dir, fname))
            except OSError:
                pass
        try:
            os.rmdir(cls.download_dir)
        except OSError:
            pass
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="BookE2EEUser",
            email="booke2ee@test.com",
            passtext="testpass",
        )
        self.login_user(self.user, self.driver, self.client)
        return super().setUp()

    def tearDown(self):
        self.driver.execute_script("window.localStorage.clear()")
        self.driver.execute_script("window.sessionStorage.clear()")
        # Clear the books IndexedDB cache so stale document lists from
        # previous tests do not leak into the file selector.
        self.driver.execute_async_script(
            """
            const done = arguments[0];
            if (window.theApp && theApp.indexedDB) {
                theApp.indexedDB.clearData("books_data").then(done).catch(done);
            } else {
                done();
            }
            """
        )
        super().tearDown()
        if "coverage" in sys.modules.keys():
            time.sleep(self.wait_time / 3)

    # ---------------------------------------------------------------------- #
    # Helpers                                                                  #
    # ---------------------------------------------------------------------- #

    def _setup_passphrase_keys(self):
        """
        Generate real ECDH + AES-GCM keys in the browser, create a
        UserEncryptionKey record in the database for the test user, and
        inject the master key and private key into sessionStorage so that
        subsequent E2EE document creation proceeds without any password
        or passphrase prompt.
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

    def _create_e2ee_chapter(self, title="E2EE Chapter", body="Chapter body"):
        """
        Create a new E2EE document in passphrase mode.

        The master key must already be in sessionStorage (call
        ``_setup_passphrase_keys`` first). With the key present the editor
        opens immediately — no password dialog appears.

        Adds *title* and *body* text, waits for the encrypted snapshot to be
        committed to the server, then closes the document and returns once the
        document list is visible again.
        """
        self.driver.get(self.base_url)
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()

        # Encryption choice dialog — select "Encrypted".
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".ui-dialog"))
        )
        self.driver.find_element(By.ID, "e2ee").click()
        self.driver.find_element(
            By.CSS_SELECTOR, ".ui-dialog .fw-dark"
        ).click()

        # With the master key in sessionStorage the editor opens directly.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )

        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            title
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").send_keys(body)

        # Give the encrypted snapshot time to be sent to and stored by the
        # server — needed so that the sanity check can later fetch and decrypt
        # the content.
        time.sleep(3)

        self.driver.find_element(By.ID, "close-document-top").click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".fw-contents tbody tr")
            )
        )

    def _insert_image_in_editor(self):
        """
        Insert an encrypted figure/image into the currently-open E2EE
        document editor.

        Uses the toolbar "Figure" button. The image is encrypted client-side
        before upload and stored in the ``EncryptedDocumentImage`` model —
        not the regular ``UserImage`` model used for unencrypted documents.

        The image file is taken from the book test-uploads directory
        (``book/tests/uploads/image.png``).
        """
        image_path = os.path.join(
            settings.PROJECT_PATH, "book/tests/uploads/image.png"
        )

        # Ensure the document body has focus.
        body = WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".doc-body"))
        )
        body.click()

        # Open the Figure dialog via the toolbar button.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.XPATH, '//*[@title="Figure"]'))
        ).click()

        # Wait for the MathLive field inside #figure-dialog — it is added
        # asynchronously via import("mathlive").then(...), and the
        # #insert-figure-image click listener is attached in the same callback.
        # Clicking before the listener is ready produces a silent no-op.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#figure-dialog span.math-field")
            )
        )
        time.sleep(1)  # Extra margin for mathlive to finish wiring up events.

        # In the figure dialog, choose "Insert image".
        self.driver.find_element(By.ID, "insert-figure-image").click()

        # Open the upload form.
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

        # Wait for the upload to complete (the row check-mark appears).
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".fw-data-table i.fa-check")
            )
        )

        # Confirm the image selection.
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Use image"]'
        ).click()

        # Close the figure dialog (OK button).
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()

        # Verify the figure node is now present in the document.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".doc-body figure")
            )
        )

    def _navigate_to_books(self):
        """Click the Books sidebar link and wait for the page to fully load.

        The books overview fetches the book list and document list via an async
        API call (``/api/book/list/``). The "Create new book" button appears as
        soon as the page renders (before the API call returns), so we cannot
        rely on its presence alone. We additionally wait until
        ``window.theApp.page.documentList`` has been populated, which happens
        only after the API call resolves and ``initializeView`` runs.
        """
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/books/"]')
            )
        ).click()
        # Wait for the button (confirms the page has rendered).
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'button[title="Create new book (Alt-n)"]')
            )
        )
        # Wait for the async document list to be populated so that the book
        # dialog will show the user's documents when it is opened.
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

    def _create_book_with_first_chapter(self, title="E2EE Book"):
        """
        Open the "Create new book" dialog, set *title*, add the first
        document in the list as a chapter, submit the dialog, and return
        once the book title is visible in the list.
        """
        self._navigate_to_books()

        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'button[title="Create new book (Alt-n)"]')
            )
        ).click()

        self.driver.find_element(By.ID, "book-title").send_keys(title)

        # Switch to the Chapters tab (index 1 in the dialog).
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()

        # Wait for the document list to be fully rendered before interacting.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "#book-document-list .file")
            )
        )

        # Select the first document in the list.
        self.driver.find_element(
            By.CSS_SELECTOR, "#book-document-list .file .file-name"
        ).click()

        # Ensure the document is actually marked as selected.
        # We use a locator rather than a captured element reference because
        # the file selector re-renders on selection, which would stale the
        # original handle.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (
                    By.CSS_SELECTOR,
                    "#book-document-list .file .file-name.selected",
                )
            )
        )

        # Wait for the add-chapter button to be clickable, then click it.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.ID, "add-chapter"))
        ).click()

        # Wait for the chapter row to appear in the chapter list.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#book-chapter-list tr")
            )
        )

        # Wait for the Submit button to be clickable before clicking.
        submit_btn = WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    '//*[contains(@class,"ui-button") and normalize-space()="Submit"]',
                )
            )
        )
        submit_btn.click()

        # Wait for the dialog to close before looking for the book list.
        # Detecting dialog closure first is more reliable than waiting for a
        # list element that may be obscured by a lingering modal.
        WebDriverWait(self.driver, self.wait_time * 2).until(
            EC.invisibility_of_element_located((By.CSS_SELECTOR, ".ui-dialog"))
        )
        # The table re-renders after a save; use a fresh wait so we do not
        # capture a stale element.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, ".book-title"))
        )

    # ---------------------------------------------------------------------- #
    # Tests                                                                    #
    # ---------------------------------------------------------------------- #

    def test_book_with_e2ee_chapter_shows_lock_icon(self):
        """
        When an E2EE document is added as a book chapter the dialog must:

        * Show a lock icon (``.e2ee-chapter-icon``) on the chapter row.
        * Show an encrypted-chapter notice (``.e2ee-chapter-notice``) below
          the chapter list mentioning "encrypted chapters".
        """
        self._setup_passphrase_keys()
        self._create_e2ee_chapter(
            title="Encrypted Chapter", body="Secret content"
        )

        self._navigate_to_books()

        # Open the book creation dialog.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'button[title="Create new book (Alt-n)"]')
            )
        ).click()

        self.driver.find_element(By.ID, "book-title").send_keys(
            "Lock Icon Book"
        )

        # Switch to the Chapters tab.
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()

        # Add the E2EE document as a chapter.
        self.driver.find_element(
            By.CSS_SELECTOR, "#book-document-list .file .file-name"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (
                    By.CSS_SELECTOR,
                    "#book-document-list .file .file-name.selected",
                )
            )
        )
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.ID, "add-chapter"))
        ).click()

        # Wait for the chapter row to render before looking for the lock icon.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#book-chapter-list tr")
            )
        )

        # A lock icon must appear on the chapter row.
        lock_icon = WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".e2ee-chapter-icon")
            )
        )
        self.assertIsNotNone(lock_icon)

        # The encrypted-chapter notice must appear below the chapter list.
        notice = WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".e2ee-chapter-notice")
            )
        )
        self.assertIn("encrypted chapters", notice.text.lower())

        # Submit the book so the dialog is cleanly dismissed.
        submit_btn = WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    '//*[contains(@class,"ui-button") and normalize-space()="Submit"]',
                )
            )
        )
        submit_btn.click()

        # Wait for the book to appear in the overview list.
        WebDriverWait(self.driver, self.wait_time * 2).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, ".book-title"))
        )

    def test_book_sanity_check_with_e2ee_chapter_and_image(self):
        """
        Create an E2EE chapter that includes an encrypted image (uploaded to
        ``EncryptedDocumentImage``), add it to a book, and run the book
        sanity check with the passphrase already unlocked in sessionStorage.

        The sanity check must:
        * Complete without reporting passphrase or decryption errors.
        * Recognise the chapter title from the decrypted content.
        """
        self._setup_passphrase_keys()

        # ---- Create the E2EE document ----------------------------------------
        self.driver.get(self.base_url)
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()

        # Encryption choice dialog.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".ui-dialog"))
        )
        self.driver.find_element(By.ID, "e2ee").click()
        self.driver.find_element(
            By.CSS_SELECTOR, ".ui-dialog .fw-dark"
        ).click()

        # Editor opens immediately (master key is in sessionStorage).
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )

        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            "E2EE Chapter with Image"
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").send_keys(
            "Chapter body text."
        )

        # Insert an encrypted image; it is uploaded to EncryptedDocumentImage.
        self._insert_image_in_editor()

        # Allow the encrypted snapshot to be committed to the server.
        # The snapshot with an image is larger, so give it extra time.
        time.sleep(5)

        self.driver.find_element(By.ID, "close-document-top").click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".fw-contents tbody tr")
            )
        )

        # ---- Build the book --------------------------------------------------
        self._create_book_with_first_chapter("Image E2EE Book")

        # ---- Open the book dialog and run the sanity check -------------------
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".book-title"))
        ).click()

        # Navigate to the Sanity Check tab (index 7 in the dialog template).
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab7"]'
        ).click()

        self.driver.find_element(
            By.CSS_SELECTOR, "#perform-sanity-check-button"
        ).click()

        # Wait for the output element to be populated.
        sanity_output = WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "sanity-check-output"))
        )
        WebDriverWait(self.driver, self.wait_time).until(
            lambda d: d.find_element(By.ID, "sanity-check-output").text.strip()
            != ""
        )

        output_text = sanity_output.text.lower()

        # Decryption must have succeeded — none of the error strings should
        # appear in the output.
        self.assertNotIn("passphrase required", output_text)
        self.assertNotIn("could not decrypt", output_text)
        self.assertNotIn(
            "encrypted chapters",
            output_text,
            "Sanity check should not report an encryption error when "
            "the passphrase is already unlocked.",
        )

        # The chapter title must have been read from the decrypted content.
        self.assertNotIn(
            "no chapter title",
            output_text,
            "Chapter title 'E2EE Chapter with Image' should be recognised "
            "after successful decryption.",
        )

        # ---- Verify the dialog shows the plaintext chapter title --------
        # Switch to the Chapters tab (optionTab1).  decryptE2EETitles in
        # BookOverview.initializeView() runs synchronously from
        # sessionStorage, so by now doc.title in this.bookOverview.
        # documentList is the plaintext title -- both the "Book chapters"
        # table and the "My documents" FileSelector should reflect it.
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()

        chapter_list = WebDriverWait(self.driver, self.wait_time).until(
            EC.visibility_of_element_located((By.ID, "book-chapter-list"))
        )
        self.assertIn(
            "E2EE Chapter with Image",
            chapter_list.text,
            "The 'Book chapters' panel must show the decrypted plaintext "
            "title, not the encrypted ciphertext.",
        )
        # The tooltip on the chapter-title cell carries the same value;
        # checking it as a separate assertion guards against the visible
        # text accidentally matching some other string on the row.
        chapter_cell = chapter_list.find_element(
            By.CSS_SELECTOR, "td.fw-checkable-td"
        )
        self.assertIn(
            "E2EE Chapter with Image",
            chapter_cell.get_attribute("title") or "",
            "The tooltip on the chapter row must contain the plaintext "
            "title.",
        )

        document_list = self.driver.find_element(By.ID, "book-document-list")
        self.assertIn(
            "E2EE Chapter with Image",
            document_list.text,
            "The 'My documents' FileSelector must show the decrypted "
            "plaintext title.",
        )

        # ---- Close the book dialog --------------------------------------
        # Submit dismisses the dialog cleanly (saveBook is a no-op since
        # nothing changed).  Wait for the dialog to be detached from the
        # DOM before continuing.
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class,"ui-button") and normalize-space()="Submit"]',
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.staleness_of(chapter_list)
        )

        # ---- Export the book as Unified HTML ----------------------------
        # Select the only book row, open the bulk dropdown and choose
        # "Export selected as Unified HTML".
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "tr:nth-child(1) > td > label")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element(
            By.XPATH,
            '//*[normalize-space()="Export selected as Unified HTML"]',
        ).click()

        # Wait for the ZIP to land in the download directory.  Chrome
        # writes to a .crdownload file first and only renames to the
        # final name when the download is complete, so simply waiting
        # for the final filename to exist is enough.
        zip_path = os.path.join(self.download_dir, "image-e2ee-book.html.zip")
        deadline = time.time() + self.wait_time * 2
        while time.time() < deadline and not os.path.isfile(zip_path):
            time.sleep(0.5)
        self.assertTrue(
            os.path.isfile(zip_path),
            f"Unified HTML export was not produced at {zip_path}",
        )

        # ---- Inspect the ZIP contents -----------------------------------
        try:
            with zipfile.ZipFile(zip_path) as zf:
                names = zf.namelist()
                image_files = [
                    n
                    for n in names
                    if n.startswith("images/") and not n.endswith("/")
                ]
                self.assertTrue(
                    len(image_files) > 0,
                    f"Unified HTML export must contain the decrypted "
                    f"chapter image under images/. ZIP contents: {names}",
                )
                self.assertIn(
                    "index.html",
                    names,
                    "Unified HTML export must contain a single index.html.",
                )
                with zf.open("index.html") as f:
                    html_content = f.read().decode("utf-8", errors="replace")

            self.assertIn(
                "Chapter body text.",
                html_content,
                "Unified HTML index.html must contain the plaintext body "
                "that was typed into the encrypted chapter.",
            )
        finally:
            os.remove(zip_path)

    def test_book_sanity_check_fails_gracefully_without_passphrase(self):
        """
        After the session-storage passphrase keys are wiped (simulating a
        fresh browser session or log-out), running the book sanity check on
        a book with E2EE chapters must:

        1. Show the passphrase unlock dialog (because a ``UserEncryptionKey``
           exists for the user but the keys are not in sessionStorage).
        2. When the user cancels that dialog, populate ``#sanity-check-output``
           with an error message that mentions "passphrase".
        """
        self._setup_passphrase_keys()
        self._create_e2ee_chapter(
            title="Secret Chapter", body="Encrypted body text"
        )
        self._create_book_with_first_chapter("No-Passphrase Test Book")

        # Wipe the in-memory key store to simulate a fresh session.
        self.driver.execute_script("window.sessionStorage.clear()")
        self.driver.refresh()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, ".book-title"))
        )

        # Open the book dialog.
        self.driver.find_element(By.CSS_SELECTOR, ".book-title").click()

        # Navigate to the Sanity Check tab.
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab7"]'
        ).click()

        # Trigger the sanity check. ``ensurePassphraseUnlocked`` detects that
        # the session keys are absent but a ``UserEncryptionKey`` exists, so it
        # opens the passphrase unlock dialog.
        self.driver.find_element(
            By.CSS_SELECTOR, "#perform-sanity-check-button"
        ).click()

        # Wait for the passphrase unlock dialog (identified by its input).
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "e2ee-passphrase-input"))
        )

        # Cancel the dialog.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    '//button[contains(@class,"fw-light")'
                    ' and normalize-space()="Cancel"]',
                )
            )
        ).click()

        # The sanity check output must now contain a passphrase-related error.
        sanity_output = WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "sanity-check-output"))
        )
        WebDriverWait(self.driver, self.wait_time).until(
            lambda d: d.find_element(By.ID, "sanity-check-output").text.strip()
            != ""
        )

        self.assertIn(
            "passphrase",
            sanity_output.text.lower(),
            "Sanity check output should explain that a passphrase is required "
            "when the user cancels the unlock dialog.",
        )
