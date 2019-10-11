from django.contrib import admin

from . import models


class BookStyleFileInline(admin.TabularInline):
    model = models.BookStyleFile


class BookStyleAdmin(admin.ModelAdmin):
    inlines = [
        BookStyleFileInline,
    ]


admin.site.register(models.BookStyle, BookStyleAdmin)


class BookAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.Book, BookAdmin)


class BookAccessRightAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.BookAccessRight, BookAccessRightAdmin)


class ChapterAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.Chapter, ChapterAdmin)
