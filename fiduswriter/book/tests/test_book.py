import time
import os

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from testing.testcases import LiveTornadoTestCase
from testing.selenium_helper import SeleniumHelper
from selenium.common.exceptions import StaleElementReferenceException

from django.core import mail
from django.conf import settings
from django.contrib.auth.models import User


class BookTest(LiveTornadoTestCase, SeleniumHelper):
    fixtures = [
        'initial_documenttemplates.json',
        'initial_styles.json',
    ]


    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.base_url = cls.live_server_url
        driver_data = cls.get_drivers(1)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        super().tearDownClass()

    def setUp(self):
        self.verificationErrors = []
        self.accept_next_alert = True
        self.user = self.create_user(
            username='Yeti',
            email='yeti@snowman.com',
            passtext='otter1'
        )
        self.login_user(self.user, self.driver, self.client)

    def tearDown(self):
        self.assertEqual([], self.verificationErrors)

    def assertInfoAlert(self, message):
        i = 0
        message_found = False
        while(i < 100):
            i = i + 1
            try:
                if self.driver.find_element(
                    By.CSS_SELECTOR,
                    "body #alerts-outer-wrapper .alerts-info"
                ).text == message:
                    message_found = True
                    break
                else:
                    time.sleep(0.1)
                    continue
            except StaleElementReferenceException:
                time.sleep(0.1)
                continue
        self.assertTrue(message_found)

    def test_books(self):
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
        self.driver.find_element(
            By.ID,
            "close-document-top"
        ).click()
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
            'a[href="#optionTab2"]'
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
            'a[href="#optionTab4"]'
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
        self.driver.find_element_by_xpath(
            '//*[contains(@class, "ui-button") and normalize-space()="Use image"]'
        ).click()
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









