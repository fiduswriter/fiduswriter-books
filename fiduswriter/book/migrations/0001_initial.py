from django.db import models, migrations
from django.conf import settings
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('document', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('usermedia', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Book',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('title', models.CharField(max_length=128)),
                ('metadata', models.TextField(default='{}')),
                ('settings', models.TextField(default='{}')),
                ('added', models.DateTimeField(auto_now_add=True)),
                ('updated', models.DateTimeField(auto_now_add=True)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='BookAccessRight',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('rights', models.CharField(max_length=1, choices=[('r', 'read'), ('w', 'read/write')])),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='book.Book')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Chapter',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('number', models.IntegerField()),
                ('part', models.CharField(default='', max_length=128, blank=True)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='book.Book')),
                ('text', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='document.Document')),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AlterUniqueTogether(
            name='bookaccessright',
            unique_together=set([('book', 'user')]),
        ),
        migrations.AddField(
            model_name='book',
            name='chapters',
            field=models.ManyToManyField(to='document.Document', null=True, through='book.Chapter', blank=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='book',
            name='chapters',
            field=models.ManyToManyField(default=None, to='document.Document', null=True, through='book.Chapter', blank=True),
        ),
        migrations.AddField(
            model_name='book',
            name='cover_image',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, default=None, blank=True, to='usermedia.Image', null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='book',
            name='owner',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
            preserve_default=True,
        ),
    ]
