# Generated by Django 3.2.4 on 2021-07-17 20:17

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        ("book", "0009_auto_20210323_1003"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookaccessright",
            name="holder_id",
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="bookaccessright",
            name="holder_type",
            field=models.ForeignKey(
                limit_choices_to=models.Q(
                    models.Q(("app_label", "user"), ("model", "user")),
                    models.Q(("app_label", "user"), ("model", "userinvite")),
                    _connector="OR",
                ),
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to="contenttypes.contenttype",
            ),
        ),
    ]
