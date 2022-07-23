from django.urls import re_path

from . import views

urlpatterns = [
    re_path("^list/$", views.list, name="book_list"),
    re_path("^save/$", views.save, name="book_save"),
    re_path("^copy/$", views.copy, name="book_copy"),
    re_path("^delete/$", views.delete, name="book_delete"),
    re_path("^move/$", views.move, name="book_move"),
    re_path(
        "^access_rights/get/$",
        views.get_access_rights,
        name="get_access_rights",
    ),
    re_path(
        "^access_rights/save/$",
        views.save_access_rights,
        name="save_access_rights",
    ),
]
