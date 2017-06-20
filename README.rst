=====
FidusWriter-Books
=====

FidusWriter-Books is a Fidus Writer plugin to allow for the composition of books
and article collections, using individual documents as chapters.


Installation
-----------

1. Install Fidus Writer if you haven't done so already.

2. Within the virtual environment set up for your Fidus Writer instance,
   running `pip install fiduswriter-books`

3. Add "book" to your INSTALLED_APPS setting in the
   configuration.py file like this::

    INSTALLED_APPS += (
        ...
        'book',
    )

4. Run `python manage.py transpile` to create the needed JavaScript files.

5. (Re)start your Fidus Writer server
