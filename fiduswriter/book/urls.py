from django.conf.urls import url

from . import views

urlpatterns = [
    url('^list/$', views.list, name='book_list'),
    url('^save/$', views.save, name='book_save'),
    url('^copy/$', views.copy, name='book_copy'),
    url('^delete/$', views.delete, name='book_delete'),
    url('^book/$', views.get_book, name='book_get_book'),
    url(
        '^accessright/save/$',
        views.access_right_save,
        name='access_right_save'
    ),
]
