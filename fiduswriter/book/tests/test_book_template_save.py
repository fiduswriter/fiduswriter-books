import os
from django.test import TestCase, Client
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from .helpers import create_user, create_book


class BookTemplateSaveTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_user("testuser", "testuser@example.com", "password")
        self.client.login(username="testuser@example.com", password="password")
        self.book = create_book(self.user, "Test Book")

    def test_add_odt_template_save(self):
        # Prepare a mock ODT template file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(current_dir, "uploads", "template.odt")

        with open(template_path, "rb") as template_file:
            odt_content = template_file.read()
            mock_odt_file = SimpleUploadedFile(
                "template.odt",
                odt_content,
                content_type="application/vnd.oasis.opendocument.text",
            )

        # Add ODT template to the book
        response = self.client.post(
            reverse("book_odt_template_save"),
            {"id": self.book.id, "file": mock_odt_file},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",  # Add this line to simulate an AJAX request
        )

        self.assertEqual(
            response.status_code,
            200,
            f"Unexpected status code: {response.status_code}",
        )
        # Verify the template was added to the book
        self.book.refresh_from_db()
        self.assertIsNotNone(self.book.odt_template)

    def test_add_docx_template_save(self):
        # Prepare a mock DOCX template file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(current_dir, "uploads", "template.docx")

        with open(template_path, "rb") as template_file:
            docx_content = template_file.read()
            mock_docx_file = SimpleUploadedFile(
                "template.docx",
                docx_content,
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )

        # Add DOCX template to the book
        response = self.client.post(
            reverse("book_docx_template_save"),
            {"id": self.book.id, "file": mock_docx_file},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(
            response.status_code,
            200,
            f"Unexpected status code: {response.status_code}",
        )
        # Verify the template was added to the book
        self.book.refresh_from_db()
        self.assertIsNotNone(self.book.docx_template)
