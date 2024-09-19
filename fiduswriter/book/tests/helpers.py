from django.contrib.auth import get_user_model
from book.models import Book


def create_user(username, email, password):
    User = get_user_model()
    user = User.objects.create_user(
        username=username, email=email, password=password
    )
    return user


def create_book(user, title):
    book = Book.objects.create(title=title, owner=user)
    return book
