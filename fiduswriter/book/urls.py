from django.conf.urls import url

from . import views

urlpatterns = [
    url("^list/$", views.list, name="book_list"),
    url("^save/$", views.save, name="book_save"),
    url("^copy/$", views.copy, name="book_copy"),
    url("^delete/$", views.delete, name="book_delete"),
    url("^move/$", views.move, name="book_move"),
    url(
        "^access_rights/get/$",
        views.get_access_rights,
        name="get_access_rights",
    ),
    url(
        "^access_rights/save/$",
        views.save_access_rights,
        name="save_access_rights",
    ),
]
