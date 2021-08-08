from django.db import models
from django.conf import settings as django_settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from document.models import Document
from usermedia.models import Image


class Book(models.Model):
    title = models.CharField(max_length=128)
    path = models.TextField(default="", blank=True)
    metadata = models.TextField(default="{}")
    settings = models.TextField(default="{}")
    cover_image = models.ForeignKey(
        Image,
        blank=True,
        null=True,
        default=None,
        on_delete=models.deletion.CASCADE,
    )
    chapters = models.ManyToManyField(
        Document, through="Chapter", blank=True, default=None
    )
    owner = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.deletion.CASCADE
    )
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Chapter(models.Model):
    text = models.ForeignKey(Document, on_delete=models.deletion.CASCADE)
    book = models.ForeignKey(Book, on_delete=models.deletion.CASCADE)
    number = models.IntegerField()
    part = models.CharField(max_length=128, blank=True, default="")


RIGHTS_CHOICES = (
    ("read", "Reader"),
    ("write", "Writer"),
)


class BookAccessRight(models.Model):
    path = models.TextField(default="", blank=True)
    book = models.ForeignKey(Book, on_delete=models.deletion.CASCADE)
    holder_choices = models.Q(app_label="user", model="user") | models.Q(
        app_label="user", model="userinvite"
    )
    holder_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, limit_choices_to=holder_choices
    )
    holder_id = models.PositiveIntegerField()
    holder_obj = GenericForeignKey("holder_type", "holder_id")
    rights = models.CharField(
        max_length=5, choices=RIGHTS_CHOICES, blank=False
    )

    class Meta(object):
        unique_together = (("book", "holder_id", "holder_type"),)

    def __str__(self):
        return f"{self.holder_obj.readable_name} {self.rights} on {self.book.title}"


class BookStyle(models.Model):
    title = models.CharField(
        max_length=128,
        help_text="The human readable title.",
        default="Default",
    )
    slug = models.SlugField(
        max_length=20,
        help_text="The base of the filenames the style occupies.",
        default="default",
        unique=True,
    )
    contents = models.TextField(
        help_text="The CSS style definiton.", default=""
    )

    def __str__(self):
        return self.title


def bookstylefile_location(instance, filename):
    # preserve the original filename
    instance.filename = filename
    return "/".join(["book-style-files", filename])


class BookStyleFile(models.Model):
    file = models.FileField(
        upload_to=bookstylefile_location,
        help_text=(
            "A file references in the style. The filename will be replaced "
            "with the final url of the file in the style."
        ),
    )
    filename = models.CharField(
        max_length=255, help_text="The original filename."
    )
    style = models.ForeignKey("BookStyle", on_delete=models.deletion.CASCADE)

    def __str__(self):
        return f"{self.filename} of {self.style.title}"

    def natural_key(self):
        return (self.file.url, self.filename)

    class Meta(object):
        unique_together = (("filename", "style"),)
