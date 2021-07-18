import time
import os
from tempfile import mkdtemp
from urllib.parse import urlparse

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from testing.testcases import LiveTornadoTestCase
from testing.selenium_helper import SeleniumHelper

from django.conf import settings


class BookTest(LiveTornadoTestCase, SeleniumHelper):
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
        self.user2 = self.create_user(
            username="Yeti2", email="yeti2@snowman.com", passtext="otter1"
        )
        self.user3 = self.create_user(
            username="Yeti3", email="yeti3@snowman.com", passtext="otter1"
        )

    def test_books(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")
        # Create chapter one doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 1"
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()
        # Create chapter two doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 2"
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()
        # Create chapter three doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 3"
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()
        # Add users 2+3 as contacts
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.ID, "preferences-btn"))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Contacts"]'
        ).click()
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".contacts-table .entry-select"
                )
            ),
            0,
        )
        self.driver.find_element_by_css_selector(
            "button[title='Invite contact']"
        ).click()
        self.driver.find_element_by_id("new-contact-user-string").send_keys(
            "yeti2@snowman.com"
        )
        self.driver.find_element_by_css_selector("button.fw-dark").click()
        time.sleep(1)
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".contacts-table .entry-select"
                )
            ),
            1,
        )
        self.driver.find_element_by_css_selector(
            "button[title='Invite contact']"
        ).click()
        self.driver.find_element_by_id("new-contact-user-string").send_keys(
            "Yeti3"
        )
        self.driver.find_element_by_css_selector("button.fw-dark").click()
        time.sleep(1)
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".contacts-table .entry-select"
                )
            ),
            2,
        )
        # Go to book section
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/books/"]')
            )
        ).click()
        # Create a new book
        self.driver.find_element(
            By.CSS_SELECTOR, 'button[title="Create new book"]'
        ).click()
        self.driver.find_element(By.ID, "book-title").send_keys("My book")
        self.driver.find_element(By.ID, "book-metadata-author").send_keys(
            "Author 1"
        )
        self.driver.find_element(By.ID, "book-metadata-subtitle").send_keys(
            "My very first book"
        )
        self.driver.find_element(By.ID, "book-metadata-publisher").send_keys(
            "Publishers United"
        )
        self.driver.find_element(By.ID, "book-metadata-copyright").send_keys(
            "Publishers United, 2000"
        )
        self.driver.find_element(By.ID, "book-metadata-keywords").send_keys(
            "Fishing, Testing, Heating"
        )
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
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#book-document-list .file:nth-child(3) .file-name",
        ).click()
        self.driver.find_element(By.ID, "add-chapter").click()
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab3"]'
        ).click()
        self.driver.find_element(By.ID, "select-cover-image-button").click()
        self.driver.find_element(
            By.CSS_SELECTOR, "button > i.fa-plus-circle"
        ).click()
        image_path = os.path.join(
            settings.PROJECT_PATH, "book/tests/uploads/image.png"
        )
        self.driver.find_element(
            By.CSS_SELECTOR, "input.fw-media-file-input"
        ).send_keys(image_path)
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Upload"]'
        ).click()
        time.sleep(1)
        self.driver.find_element_by_xpath(
            (
                '//*[contains(@class, "ui-button") '
                'and normalize-space()="Use image"]'
            )
        ).click()
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 1
        )
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 1
        )
        # Accept invite for user 3
        self.login_user(self.user3, self.driver, self.client)
        self.driver.refresh()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Go to contacts"]'
        ).click()
        self.driver.find_element_by_css_selector(
            "button.respond-invite"
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Accept invite"]'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Books"]'
        ).click()
        # Login as user 1 again.
        self.login_user(self.user, self.driver, self.client)
        self.driver.refresh()
        time.sleep(1)
        # Add access rights for user 2 (write) + 3 (read)
        self.driver.find_element(
            By.CSS_SELECTOR,
            ".owned-by-user .icon-access-right.icon-access-write",
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#my-contacts tr .fw-checkable"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#my-contacts tr:nth-child(2) .fw-checkable"
        ).click()
        self.driver.find_element(By.ID, "add-share-contact").click()
        self.driver.find_elements(
            By.CSS_SELECTOR, ".fa-caret-down.edit-right"
        )[1].click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Write"]'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        # Check that access rights are listed
        self.driver.refresh()
        time.sleep(1)
        self.driver.find_element(
            By.CSS_SELECTOR, ".icon-access-right.icon-access-write"
        ).click()
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    'tr.collaborator-tr[data-rights="write"]'
                )
            ),
            1,
        )
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    'tr.collaborator-tr[data-rights="read"]'
                )
            ),
            1,
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Close"]'
        ).click()
        # Login as user 2 and check that write access is there and usable
        self.login_user(self.user2, self.driver, self.client)
        self.driver.refresh()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Go to contacts"]'
        ).click()
        self.driver.find_element_by_css_selector(
            "button.respond-invite"
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Accept invite"]'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Books"]'
        ).click()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 1
        )
        # check write access
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".icon-access-right.icon-access-write"
                )
            ),
            1,
        )
        # check that user cannot change access rights
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".owned-by-user .icon-access-right.icon-access-write"
                )
            ),
            0,
        )
        self.driver.find_element_by_css_selector(".book-title").click()
        self.driver.find_element_by_id("book-title").send_keys(" EXTRA")
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                ".fw-ar-container:nth-child(3) tr .fw-inline"
            ).text,
            "1 Chapter 1",
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                ".fw-ar-container:nth-child(3) tr:nth-child(2) .fw-inline"
            ).text,
            "2 Chapter 2",
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                ".fw-ar-container:nth-child(3) tr:nth-child(3) .fw-inline"
            ).text,
            "3 Chapter 3",
        )
        self.driver.find_element_by_css_selector(
            ".fw-ar-container:nth-child(3) tr .book-sort-down"
        ).click()
        self.driver.find_element_by_css_selector(
            ".fw-ar-container:nth-child(3) tr:nth-child(3) .book-sort-up"
        ).click()
        self.driver.find_element_by_css_selector(
            ".fw-ar-container:nth-child(3) tr:nth-child(2) .book-sort-up"
        ).click()
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            self.driver.find_element_by_css_selector(".book-title").text,
            "My book EXTRA",
        )
        self.driver.refresh()
        time.sleep(1)
        self.assertEqual(
            self.driver.find_element_by_css_selector(".book-title").text,
            "My book EXTRA",
        )
        # Login as user 3 and check that read access are there and usable
        self.login_user(self.user3, self.driver, self.client)
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 1
        )
        # check read access
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".icon-access-right.icon-access-read"
                )
            ),
            1,
        )
        # Check that the user cannot change the book
        self.driver.find_element_by_css_selector(".book-title").click()
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    "#book-title[disabled]"
                )
            ),
            1,
        )
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                ".fw-ar-container tr .fw-inline"
            ).text,
            "1 Chapter 3",
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                ".fw-ar-container tr:nth-child(2) .fw-inline"
            ).text,
            "2 Chapter 2",
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                ".fw-ar-container tr:nth-child(3) .fw-inline"
            ).text,
            "3 Chapter 1",
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Close"]'
        ).click()

        # We export the book
        # Epub
        self.driver.find_element_by_css_selector(
            "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Export selected as Epub"]'
        ).click()
        time.sleep(3)
        assert os.path.isfile(
            os.path.join(self.download_dir, "my-book-extra.epub")
        )
        os.remove(os.path.join(self.download_dir, "my-book-extra.epub"))
        # HTML
        self.driver.refresh()
        self.driver.find_element_by_css_selector(
            "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Export selected as HTML"]'
        ).click()
        time.sleep(1)
        assert os.path.isfile(
            os.path.join(self.download_dir, "my-book-extra.html.zip")
        )
        os.remove(os.path.join(self.download_dir, "my-book-extra.html.zip"))
        # LaTeX
        self.driver.refresh()
        self.driver.find_element_by_css_selector(
            "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Export selected as LaTeX"]'
        ).click()
        time.sleep(1)
        assert os.path.isfile(
            os.path.join(self.download_dir, "my-book-extra.latex.zip")
        )
        os.remove(os.path.join(self.download_dir, "my-book-extra.latex.zip"))

        # Copy document
        self.driver.refresh()
        self.driver.find_element_by_css_selector(
            "tr:nth-child(1) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Copy selected"]'
        ).click()
        # Check access rights for new instance
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".owned-by-user .icon-access-right.icon-access-write"
                )
            ),
            1,
        )
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 2
        )
        self.assertEqual(
            self.driver.find_elements_by_css_selector(".book-title")[0].text,
            "My book EXTRA",
        )
        self.assertEqual(
            self.driver.find_elements_by_css_selector(".book-title")[1].text,
            "Copy of My book EXTRA",
        )
        # Delete the second book
        self.driver.find_element_by_css_selector(".delete-book i").click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Delete"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 1
        )
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(".book-title")), 1
        )

    def test_path(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/books/")
        # Create a new book
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'button[title="Create new book"]')
            )
        ).click()
        self.driver.find_element_by_css_selector("#book-title").click()
        self.driver.find_element_by_css_selector("#book-title").send_keys(
            "Book 1"
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".fw-contents tbody tr .fw-data-table-title"
                )
            ),
            1,
        )
        # Create new folder 'Releases' and enter
        self.driver.find_element(
            By.CSS_SELECTOR, 'button[title="Create new folder"]'
        ).click()
        self.driver.find_element(By.CSS_SELECTOR, "#new-folder-name").click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#new-folder-name"
        ).send_keys("Releases")
        self.driver.find_element(By.CSS_SELECTOR, "button.fw-dark").click()
        time.sleep(1)
        trs = self.driver.find_elements_by_css_selector(
            ".fw-contents tbody tr .fw-data-table-title"
        )
        self.assertEqual(len(trs), 1)
        self.assertEqual(trs[0].text, "..")
        self.assertEqual(
            urlparse(self.driver.current_url).path, "/books/Releases/"
        )
        self.assertEqual(
            self.driver.find_element(By.CSS_SELECTOR, ".fw-contents h1").text,
            "/Releases/",
        )
        # Create second book inside of Releases folder
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'button[title="Create new book"]')
            )
        ).click()
        self.driver.find_element_by_css_selector("#book-title").click()
        self.driver.find_element_by_css_selector("#book-title").send_keys(
            "Book 2"
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        trs = self.driver.find_elements_by_css_selector(
            ".fw-contents tbody tr .fw-data-table-title"
        )
        self.assertEqual(len(trs), 2)
        self.assertEqual(trs[0].text, "..")
        self.assertEqual(trs[1].text, "Book 2")
        # Go to top folder
        trs[0].click()
        time.sleep(1)
        trs = self.driver.find_elements_by_css_selector(
            ".fw-contents tbody tr .fw-data-table-title"
        )
        self.assertEqual(len(trs), 2)
        self.assertEqual(trs[0].text, "Releases")
        self.assertEqual(trs[1].text, "Book 1")
        # Move Book 1 into Releases folder.
        self.driver.find_element_by_css_selector(
            "tr:nth-child(2) > td > label"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Move selected"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            self.driver.find_element(
                By.CSS_SELECTOR, 'input[placeholder="Insert path"]'
            ).get_attribute("value"),
            "/Book 1",
        )
        self.driver.find_element(
            By.CSS_SELECTOR, "#move-dialog .folder-content .folder-name"
        ).click()
        time.sleep(1)
        self.assertEqual(
            self.driver.find_element(
                By.CSS_SELECTOR, 'input[placeholder="Insert path"]'
            ).get_attribute("value"),
            "/Releases/Book 1",
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        trs = self.driver.find_elements_by_css_selector(
            ".fw-contents tbody tr .fw-data-table-title"
        )
        self.assertEqual(len(trs), 1)
        self.assertEqual(trs[0].text, "Releases")
        trs[0].click()
        time.sleep(1)
        trs = self.driver.find_elements_by_css_selector(
            ".fw-contents tbody tr .fw-data-table-title"
        )
        time.sleep(1)
        self.assertEqual(len(trs), 3)
        self.assertEqual(trs[0].text, "..")
        self.assertEqual(trs[1].text, "Book 1")
        self.assertEqual(trs[2].text, "Book 2")

    def test_sanity_check(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")
        # Create chapter one doc - with a leftover track change and comment
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 1"
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").send_keys(
            "Some content"
        )
        # Add a comment
        ActionChains(self.driver).key_down(Keys.SHIFT).send_keys(
            Keys.LEFT
        ).send_keys(Keys.LEFT).send_keys(Keys.LEFT).send_keys(
            Keys.LEFT
        ).key_up(
            Keys.SHIFT
        ).perform()
        self.driver.find_element(By.CSS_SELECTOR, "button .fa-comment").click()
        ActionChains(self.driver).send_keys(
            "This needs to be reviewed!"
        ).perform()
        self.driver.find_element(
            By.CSS_SELECTOR, ".comment-btns .submit"
        ).click()
        time.sleep(1)
        self.driver.find_element(
            By.CSS_SELECTOR, ".header-menu:nth-child(5) > .header-nav-item"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "li:nth-child(1) > .fw-pulldown-item"
        ).click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").send_keys(
            "\nTracked content"
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()
        # Create chapter two doc - with an internal link and reference with
        # a missing target.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 2"
        )
        # We enable the abstract
        self.driver.find_element(
            By.CSS_SELECTOR, "#header-navigation > div:nth-child(3) > span"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            (
                "#header-navigation > div:nth-child(3) > div "
                "> ul > li:nth-child(1) > span"
            ),
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            (
                "#header-navigation > div:nth-child(3) > div "
                "> ul > li:nth-child(1) > div > ul > li:nth-child(3) > span"
            ),
        ).click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").click()
        ActionChains(self.driver).send_keys(Keys.LEFT).send_keys(
            "An abstract title"
        ).perform()
        time.sleep(1)
        self.driver.find_element(
            By.CSS_SELECTOR, "#toolbar > div > div > div:nth-child(3) > div"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            (
                "#toolbar > div > div > div:nth-child(3) > div > div > "
                "ul > li:nth-child(4) > span > label"
            ),
        ).click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").send_keys(
            "Some content\n"
        )
        # We add a cross reference for the heading
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#toolbar > div > div > div:nth-child(9) > button > span > i",
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#edit-link > div:nth-child(2) > select"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#edit-link > div:nth-child(2) > select > option:nth-child(2)",
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            (
                "body > div.ui-dialog.ui-corner-all.ui-widget."
                "ui-widget-content.ui-front.ui-dialog-buttons > "
                "div.ui-dialog-buttonpane.ui-widget-content."
                "ui-helper-clearfix > div > button.fw-dark."
                "fw-button.ui-button.ui-corner-all.ui-widget"
            ),
        ).click()
        cross_reference = self.driver.find_element(
            By.CSS_SELECTOR, ".article-body .cross-reference"
        )
        assert cross_reference.text == "An abstract title"
        # We add an internal link
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#toolbar > div > div > div:nth-child(9) > button > span > i",
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#edit-link > div:nth-child(5) > select"
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#edit-link > div:nth-child(5) > select > option:nth-child(2)",
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            (
                "body > div.ui-dialog.ui-corner-all.ui-widget."
                "ui-widget-content.ui-front.ui-dialog-buttons > "
                "div.ui-dialog-buttonpane.ui-widget-content."
                "ui-helper-clearfix > div > button.fw-dark."
                "fw-button.ui-button.ui-corner-all.ui-widget"
            ),
        ).click()
        internal_link = self.driver.find_element(
            By.CSS_SELECTOR, ".article-body a"
        )
        assert internal_link.text == "An abstract title"
        # We delete the contents from the heading
        self.driver.find_element(
            By.CSS_SELECTOR, ".article-abstract h3"
        ).click()
        ActionChains(self.driver).send_keys(Keys.BACKSPACE).send_keys(
            Keys.BACKSPACE
        ).send_keys(Keys.BACKSPACE).send_keys(Keys.BACKSPACE).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).send_keys(
            Keys.BACKSPACE
        ).perform()
        cross_reference = self.driver.find_element(
            By.CSS_SELECTOR, ".article-body .cross-reference.missing-target"
        )
        assert cross_reference.text == "MISSING TARGET"
        internal_link = self.driver.find_element(
            By.CSS_SELECTOR, ".article-body a.missing-target"
        )
        assert internal_link.get_attribute("title") == "Missing target"
        self.assertEqual(
            len(
                self.driver.find_elements_by_css_selector(
                    ".margin-box.warning"
                )
            ),
            2,
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()
        # Create chapter three doc - without a title
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-body").send_keys(
            "Chapter 3"
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()
        # Create a book with these three chapters and run the sanity check.
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/books/"]')
            )
        ).click()
        # Create a new book
        self.driver.find_element(
            By.CSS_SELECTOR, 'button[title="Create new book"]'
        ).click()
        self.driver.find_element(By.ID, "book-title").send_keys("My book")
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
        self.driver.find_element(
            By.CSS_SELECTOR,
            "#book-document-list .file:nth-child(3) .file-name",
        ).click()
        self.driver.find_element(By.ID, "add-chapter").click()
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab5"]'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#perform-sanity-check-button"
        ).click()
        warnings = self.driver.find_elements(
            By.CSS_SELECTOR, "#sanity-check-output li"
        )
        self.assertEqual(len(warnings), 5)
        self.assertEqual(
            warnings[0].text, "Unresolved comments (Chapter 1, /Chapter 1)"
        )
        self.assertEqual(
            warnings[1].text,
            "Unresolved tracked changes (Chapter 1, /Chapter 1)",
        )
        self.assertEqual(
            warnings[2].text,
            "Cross references without targets (Chapter 2, /Chapter 2)",
        )
        self.assertEqual(
            warnings[3].text,
            "Internal links without target (Chapter 2, /Chapter 2)",
        )
        self.assertEqual(
            warnings[4].text, "No chapter title (Chapter 3, /Untitled)"
        )
