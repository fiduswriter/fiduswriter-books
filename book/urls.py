from django.conf.urls import url

from base.views import app
from . import views

urlpatterns = [
    url('^$', app, name='index'),
    url('^booklist/$', views.get_booklist_js, name='get_booklist_js'),
    url('^save/$', views.save_js, name='save_js'),
    url('^copy/$', views.copy_js, name='copy_js'),
    url('^delete/$', views.delete_js, name='delete_js'),
    url('^print/\d+/$', views.print_book, name='print'),
    url('^book/$', views.get_book_js, name='get_book_js'),
    url(
        '^accessright/save/$',
        views.access_right_save_js,
        name='access_right_save_js'
    ),
]
