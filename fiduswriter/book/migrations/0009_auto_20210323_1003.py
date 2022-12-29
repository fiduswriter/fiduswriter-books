# Generated by Django 3.1.4 on 2021-03-23 09:03

from django.db import migrations


def update_figure_cats(apps, schema_editor):
    BookStyle = apps.get_model("book", "BookStyle")
    for style in BookStyle.objects.all():
        contents = style.contents
        contents = contents.replace("cat-0 cat-1", "cat-figure cat-equation cat-photo")
        contents = contents.replace("cat-0", "cat-figure")
        contents = contents.replace("cat-1", "cat-photo")
        contents = contents.replace("cat-2", "cat-table")
        style.contents = contents
        style.save()


class Migration(migrations.Migration):

    dependencies = [
        ("book", "0008_auto_20210228_1421"),
    ]

    operations = [
        migrations.RunPython(update_figure_cats),
    ]
