from django.apps import AppConfig


class Config(AppConfig):
    name = "book"
    default_auto_field = "django.db.models.AutoField"

    def ready(self):
        import book.signals  # noqa
