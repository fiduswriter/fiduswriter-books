from django.db import models

from document.models import Document
from usermedia.models import Image
from django.contrib.auth.models import User


class Book(models.Model):
    title = models.CharField(max_length=128)
    metadata = models.TextField(default='{}')
    settings = models.TextField(default='{}')
    cover_image = models.ForeignKey(
        Image,
        blank=True,
        null=True,
        default=None,
        on_delete=models.deletion.CASCADE
    )
    chapters = models.ManyToManyField(
        Document, through='Chapter', blank=True, default=None)
    owner = models.ForeignKey(
        User,
        on_delete=models.deletion.CASCADE
    )
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Chapter(models.Model):
    text = models.ForeignKey(
        Document,
        on_delete=models.deletion.CASCADE
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.deletion.CASCADE
    )
    number = models.IntegerField()
    part = models.CharField(max_length=128, blank=True, default='')

RIGHTS_CHOICES = (
    ('read', 'Reader'),
    ('write', 'Writer'),
)


class BookAccessRight(models.Model):
    book = models.ForeignKey(
        Book,
        on_delete=models.deletion.CASCADE
    )
    user = models.ForeignKey(
        User,
        on_delete=models.deletion.CASCADE
    )
    rights = models.CharField(
        max_length=5,
        choices=RIGHTS_CHOICES,
        blank=False)

    class Meta(object):
        unique_together = (("book", "user"),)

    def __str__(self):
        return self.user.readable_name + \
            ' (' + self.rights + ') on ' + self.book.title
