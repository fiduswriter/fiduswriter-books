# AGENTS.md — fiduswriter-books-plugin

This file contains information for AI coding agents working on the
`fiduswriter-books-plugin` repository. Read this first if you are unfamiliar
with the project.

## Project overview

`fiduswriter-books-plugin` is a Django plugin for Fidus Writer that adds book
management: grouping documents into books, ordering chapters, and exporting
books to various formats.

- Package name: `fiduswriter_books` (Python egg)
- License: `AGPL-3.0`
- Repository: `https://git.fiduswriter.org/fiduswriter/fiduswriter-books-plugin.git`
- Author: Johannes Wilm

## Relationship to other repositories

This plugin used to contain the book import/export JavaScript code. That code
has been moved to the `@fiduswriter/books-document` npm library. This plugin
now:

- Provides Django models, views, templates, and admin for books.
- Provides the browser UI for book creation, chapter management, and export.
- Imports book export/import logic from `@fiduswriter/books-document`.

Dependency direction:

```
fiduswriter-books-plugin/     (this repo: Django plugin, UI, models)
        │
        │ depends on
        ▼
@fiduswriter/books-document   (book-level importers/exporters)
        │
        │ depends on
        ▼
@fiduswriter/document         (document schema and filters)
        │
        │ depends on
        ▼
fwtoolkit                     (UI toolkit)
```

## Scope

Code in this repository should be limited to:

- Django `book` app: models, views, admin, migrations, URLs.
- Book browser UI: templates and JavaScript modules under
  `fiduswriter/book/static/js/modules/books/`.
- Book Selenium tests.

Do **not** put in this repository:

- Generic document import/export logic (belongs in `@fiduswriter/document`).
- Book-level import/export logic (belongs in `@fiduswriter/books-document`).
- Generic UI components (belongs in `fwtoolkit`).

## Technology stack

- **Backend:** Django (same version as the main Fidus Writer app).
- **Frontend:** ES6 modules, transpiled by `django-npm-mjs` in the main app.
- **Build / transpilation:** Done by the main Fidus Writer app; this plugin
  contributes a `package.json5` for its npm dependency.

## Directory layout

```
.
├── fiduswriter/
│   └── book/
│       ├── models.py           # Book, Chapter, BookStyle, etc.
│       ├── views.py            # API views for book management
│       ├── admin.py
│       ├── urls.py
│       ├── migrations/
│       ├── templates/          # Django templates for book UI
│       ├── static/js/modules/books/  # Browser-side book UI
│       ├── tests/              # Selenium tests
│       └── package.json5       # npm dependency on @fiduswriter/books-document
├── setup.py
├── pyproject.toml
└── README.md
```

## Build and test commands

This plugin does not build itself in isolation. Development happens inside a
Fidus Writer installation where the plugin is installed.

```bash
# From the main Fidus Writer app directory (fiduswriter-server-backend/fiduswriter/)
python manage.py test book
```

The plugin's JavaScript is transpiled together with the main app:

```bash
python manage.py transpile --force
```

## JavaScript imports

Because `django-npm-mjs` overlays `static/js/modules/` from all installed apps,
modules in this plugin can import from the main app and vice versa using
relative paths.

The plugin also imports from npm packages declared in `book/package.json5`,
notably `@fiduswriter/books-document`.

## Pre-commit hooks

This repository has a `.pre-commit-config.yaml` that runs Python linting,
formatting, import checks, and JavaScript/style linting. Run before committing:

```bash
pre-commit run --all-files
```

## Code style guidelines

- Follow the main Fidus Writer app's conventions for Python and JavaScript.
- Keep Django-specific code in this plugin; delegate book export/import to
  `@fiduswriter/books-document`.
- Use the `fw-*` CSS class prefix for any plugin-specific UI elements to stay
  consistent with `fwtoolkit` and the main app.

## Testing instructions

- Book tests are Selenium-based and live in `fiduswriter/book/tests/`.
- Run them from the main app with `python manage.py test book`.
- The main app must have the plugin installed and listed in `INSTALLED_APPS`.

## Release checklist

- Ensure `pre-commit run --all-files` passes.
- Ensure the book tests pass in the main Fidus Writer app.
- Update the version in `setup.py` / `pyproject.toml` if needed.
- If `@fiduswriter/books-document` changed, update
  `fiduswriter/book/package.json5` and re-run `python manage.py transpile
  --force` in the main app.
- Push commits and tags.

## Useful references

- `fiduswriter/book/package.json5` — npm dependency on
  `@fiduswriter/books-document`.
- `fiduswriter/book/static/js/modules/books/` — browser-side book UI.
- `fiduswriter/book/tests/` — Selenium tests.
- Main Fidus Writer `AGENTS.md` — shared build, routing, and testing
  conventions.
- `@fiduswriter/books-document` and `@fiduswriter/document` — the libraries
  this plugin consumes.
