import time
import os
from tempfile import mkdtemp

from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from testing.testcases import LiveTornadoTestCase
from testing.selenium_helper import SeleniumHelper

from django.conf import settings


class BookTest(LiveTornadoTestCase, SeleniumHelper):
    fixtures = [
        'initial_documenttemplates.json',
        'initial_styles.json',
        'initial_book_data.json'
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
            username='Yeti',
            email='yeti@snowman.com',
            passtext='otter1'
        )
        self.user2 = self.create_user(
            username='Yeti2',
            email='yeti2@snowman.com',
            passtext='otter1'
        )
        self.user3 = self.create_user(
            username='Yeti3',
            email='yeti3@snowman.com',
            passtext='otter1'
        )

    def test_books(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")
        # Create chapter one doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    ".new_document button"
                )
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'editor-toolbar'))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 1"
        )
        time.sleep(1)
        self.driver.find_element(
            By.ID,
            "close-document-top"
        ).click()
        # Create chapter two doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    ".new_document button"
                )
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'editor-toolbar'))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 2"
        )
        time.sleep(1)
        self.driver.find_element(
            By.ID,
            "close-document-top"
        ).click()
        # Create chapter three doc
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    ".new_document button"
                )
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'editor-toolbar'))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".article-title").send_keys(
            "Chapter 3"
        )
        time.sleep(1)
        self.driver.find_element(
            By.ID,
            "close-document-top"
        ).click()
        # Add users 2+3 as contacts
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.ID, 'preferences-btn'))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Contacts"]'
        ).click()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '#team-table .entry-select'
            )),
            0
        )
        self.driver.find_element_by_css_selector(
            "button[title='Add new contact']"
        ).click()
        self.driver.find_element_by_id(
            "new-member-user-string"
        ).send_keys('yeti2@snowman.com')
        self.driver.find_element_by_css_selector(
            "button.fw-dark"
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '#team-table .entry-select'
            )),
            1
        )
        self.driver.find_element_by_css_selector(
            "button[title='Add new contact']"
        ).click()
        self.driver.find_element_by_id(
            "new-member-user-string"
        ).send_keys('Yeti3')
        self.driver.find_element_by_css_selector(
            "button.fw-dark"
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '#team-table .entry-select'
            )),
            2
        )
        # Go to book section
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/book/"]')
            )
        ).click()
        # Create a new book
        self.driver.find_element(
            By.CSS_SELECTOR,
            'button[title="Create new book"]'
        ).click()
        self.driver.find_element(
            By.ID,
            'book-title'
        ).send_keys('My book')
        self.driver.find_element(
            By.ID,
            'book-metadata-author'
        ).send_keys('Author 1')
        self.driver.find_element(
            By.ID,
            'book-metadata-subtitle'
        ).send_keys('My very first book')
        self.driver.find_element(
            By.ID,
            'book-metadata-publisher'
        ).send_keys('Publishers United')
        self.driver.find_element(
            By.ID,
            'book-metadata-copyright'
        ).send_keys('Publishers United, 2000')
        self.driver.find_element(
            By.ID,
            'book-metadata-keywords'
        ).send_keys('Fishing, Testing, Heating')
        self.driver.find_element(
            By.CSS_SELECTOR,
            'a[href="#optionTab1"]'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '#book-document-list > tr'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '#book-document-list > tr:nth-child(2)'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '#book-document-list > tr:nth-child(3)'
        ).click()
        self.driver.find_element(
            By.ID,
            'add-chapter'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            'a[href="#optionTab3"]'
        ).click()
        self.driver.find_element(
            By.ID,
            'select-cover-image-button'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            'button > i.fa-plus-circle'
        ).click()
        image_path = os.path.join(
            settings.PROJECT_PATH,
            'book/tests/uploads/image.png'
        )
        self.driver.find_element(
            By.CSS_SELECTOR,
            'input.fw-media-file-input'
        ).send_keys(image_path)
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Upload"]'
        ).click()
        time.sleep(1)
        self.driver.find_element_by_xpath((
            '//*[contains(@class, "ui-button") '
            'and normalize-space()="Use image"]'
        )).click()
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            1
        )
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            1
        )
        # Add access rights for user 2 (write) + 3 (read)
        self.driver.find_element(
            By.CSS_SELECTOR,
            '.owned-by-user .icon-access-right.icon-access-write'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '#my-contacts tr .fw-checkable'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '#my-contacts tr:nth-child(2) .fw-checkable'
        ).click()
        self.driver.find_element(
            By.ID,
            'add-share-member'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '.fa-caret-down.edit-right'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Write"]'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        # Check that access rights are listed
        self.driver.refresh()
        self.driver.find_element(
            By.CSS_SELECTOR,
            '.icon-access-right.icon-access-write'
        ).click()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                'tr.collaborator-tr[data-right="write"]'
            )),
            1
        )
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                'tr.collaborator-tr[data-right="read"]'
            )),
            1
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Close"]'
        ).click()
        # Login as user 2 and check that write access are there and usable
        self.login_user(self.user2, self.driver, self.client)
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            1
        )
        # check write access
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.icon-access-right.icon-access-write'
            )),
            1
        )
        # check that user cannot change access rights
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.owned-by-user .icon-access-right.icon-access-write'
            )),
            0
        )
        self.driver.find_element_by_css_selector(
            '.book-title'
        ).click()
        self.driver.find_element_by_id(
            'book-title'
        ).send_keys(' EXTRA')
        self.driver.find_element(
            By.CSS_SELECTOR,
            'a[href="#optionTab1"]'
        ).click()
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.fw-ar-container:nth-child(3) tr .fw-inline'
            ).text,
            '1 Chapter 3'
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.fw-ar-container:nth-child(3) tr:nth-child(2) .fw-inline'
            ).text,
            '2 Chapter 2'
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.fw-ar-container:nth-child(3) tr:nth-child(3) .fw-inline'
            ).text,
            '3 Chapter 1'
        )
        self.driver.find_element_by_css_selector(
            '.fw-ar-container:nth-child(3) tr .book-sort-down'
        ).click()
        self.driver.find_element_by_css_selector(
            '.fw-ar-container:nth-child(3) tr:nth-child(3) .book-sort-up'
        ).click()
        self.driver.find_element_by_css_selector(
            '.fw-ar-container:nth-child(3) tr:nth-child(2) .book-sort-up'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.book-title'
            ).text,
            'My book EXTRA'
        )
        self.driver.refresh()
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.book-title'
            ).text,
            'My book EXTRA'
        )
        # Login as user 3 and check that read access are there and usable
        self.login_user(self.user3, self.driver, self.client)
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            1
        )
        # check read access
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.icon-access-right.icon-access-read'
            )),
            1
        )
        # Check that the user cannot change the book
        self.driver.find_element_by_css_selector(
            '.book-title'
        ).click()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '#book-title[disabled]'
            )),
            1
        )
        self.driver.find_element(
            By.CSS_SELECTOR,
            'a[href="#optionTab1"]'
        ).click()
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.fw-ar-container tr .fw-inline'
            ).text,
            '1 Chapter 1'
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.fw-ar-container tr:nth-child(2) .fw-inline'
            ).text,
            '2 Chapter 2'
        )
        self.assertEqual(
            self.driver.find_element_by_css_selector(
                '.fw-ar-container tr:nth-child(3) .fw-inline'
            ).text,
            '3 Chapter 3'
        )
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Close"]'
        ).click()

        # We export the book
        # Epub
        self.driver.find_element_by_css_selector(
            'tr:nth-child(1) > td > label'
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '.dt-bulk-dropdown'))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Export selected as Epub"]'
        ).click()
        time.sleep(3)
        assert os.path.isfile(
            os.path.join(self.download_dir, 'my-book-extra.epub')
        )
        os.remove(os.path.join(self.download_dir, 'my-book-extra.epub'))
        # HTML
        self.driver.refresh()
        self.driver.find_element_by_css_selector(
            'tr:nth-child(1) > td > label'
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '.dt-bulk-dropdown'))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Export selected as HTML"]'
        ).click()
        time.sleep(1)
        assert os.path.isfile(
            os.path.join(self.download_dir, 'my-book-extra.html.zip')
        )
        os.remove(os.path.join(self.download_dir, 'my-book-extra.html.zip'))
        # LaTeX
        self.driver.refresh()
        self.driver.find_element_by_css_selector(
            'tr:nth-child(1) > td > label'
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '.dt-bulk-dropdown'))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Export selected as LaTeX"]'
        ).click()
        time.sleep(1)
        assert os.path.isfile(
            os.path.join(self.download_dir, 'my-book-extra.latex.zip')
        )
        os.remove(os.path.join(self.download_dir, 'my-book-extra.latex.zip'))

        # Copy document
        self.driver.refresh()
        self.driver.find_element_by_css_selector(
            'tr:nth-child(1) > td > label'
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '.dt-bulk-dropdown'))
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Copy selected"]'
        ).click()
        # Check access rights for new instance
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.owned-by-user .icon-access-right.icon-access-write'
            )),
            1
        )
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            2
        )
        self.assertEqual(
            self.driver.find_elements_by_css_selector(
                '.book-title'
            )[0].text,
            'My book EXTRA'
        )
        self.assertEqual(
            self.driver.find_elements_by_css_selector(
                '.book-title'
            )[1].text,
            'My book EXTRA'
        )
        # Delete the second book
        self.driver.find_element_by_css_selector(
            '.delete-book i'
        ).click()
        self.driver.find_element_by_xpath(
            '//*[normalize-space()="Delete"]'
        ).click()
        time.sleep(1)
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            1
        )
        self.driver.refresh()
        self.assertEqual(
            len(self.driver.find_elements_by_css_selector(
                '.book-title'
            )),
            1
        )
