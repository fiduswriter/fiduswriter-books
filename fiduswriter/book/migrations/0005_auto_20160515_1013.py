# Generated by Django 1.9.5 on 2016-05-15 15:13
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book", "0004_auto_20160515_1008"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bookaccessright",
            name="rights",
            field=models.CharField(
                choices=[("read", "Reader"), ("write", "Writer")], max_length=5
            ),
        ),
    ]
