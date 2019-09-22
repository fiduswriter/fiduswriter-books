FidusWriter-Books
=================

FidusWriter-Books is a Fidus Writer plugin to allow for the composition of books
and article collections, using individual documents as chapters.


Installation
------------

1) Install Fidus Writer like this:

    pip install fiduswriter[books]

2) Add "book" to your INSTALLED_APPS setting in the
   configuration.py file like this::

    INSTALLED_APPS += (
        ...
        'book',
    )

3) Run ``fiduswriter setup`` to create the needed database tables and to create the needed JavaScript files.

4) (Re)start your Fidus Writer server
