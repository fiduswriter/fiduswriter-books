from django.core.mail import send_mail
from django.conf import settings
from django.utils.translation import gettext as _

from base.html_email import html_email


def send_share_notification(
    book_title,
    owner,
    link,
    collaborator_name,
    collaborator_email,
    rights,
    change,
):
    if len(book_title) == 0:
        book_title = _("Untitled")
    if change:
        message_text = _(
            (
                "Hey %(collaborator_name)s,\n%(owner)s has changed your "
                "access rights to %(rights)s on the book '%(book_title)s'. "
                "\nSee books: %(link)s"
            )
        ) % {
            "owner": owner,
            "rights": rights,
            "collaborator_name": collaborator_name,
            "link": link,
            "book_title": book_title,
        }
        body_html_intro = _(
            (
                "<p>Hey %(collaborator_name)s,<br>%(owner)s has changed "
                "your access rights to %(rights)s on the book "
                "'%(book_title)s'.</p>"
            )
        ) % {
            "owner": owner,
            "rights": rights,
            "collaborator_name": collaborator_name,
            "book_title": book_title,
        }
    else:
        message_text = _(
            (
                "Hey %(collaborator_name)s,\n%(owner)s has shared the book "
                "'%(book_title)s' with you and given you %(rights)s access "
                "rights. "
                "\nOpen book: %(link)s"
            )
        ) % {
            "owner": owner,
            "rights": rights,
            "collaborator_name": collaborator_name,
            "link": link,
            "book_title": book_title,
        }
        body_html_intro = _(
            (
                "<p>Hey %(collaborator_name)s,<br>%(owner)s has shared the "
                "book '%(book_title)s' with you and given you "
                "%(rights)s access rights.</p>"
            )
        ) % {
            "owner": owner,
            "rights": rights,
            "collaborator_name": collaborator_name,
            "book_title": book_title,
        }

    body_html = (
        "<h1>%(book_title)s %(shared)s</h1>"
        "%(body_html_intro)s"
        "<table>"
        "<tr><td>"
        "%(Book)s"
        "</td><td>"
        "<b>%(book_title)s</b>"
        "</td></tr>"
        "<tr><td>"
        "%(Editor)s"
        "</td><td>"
        "%(owner)s"
        "</td></tr>"
        "<tr><td>"
        "%(AccessRights)s"
        "</td><td>"
        "%(rights)s"
        "</td></tr>"
        "</table>"
        '<div class="actions"><a class="button" href="%(link)s">'
        "%(AccessBooks)s"
        "</a></div>"
    ) % {
        "shared": _("shared"),
        "body_html_intro": body_html_intro,
        "Book": _("Book"),
        "book_title": book_title,
        "Editor": _("Editor"),
        "owner": owner,
        "AccessRights": _("Access Rights"),
        "rights": rights,
        "link": link,
        "AccessBooks": _("Access books"),
    }
    send_mail(
        _("Book shared: %(book_title)s") % {"book_title": book_title},
        message_text,
        settings.DEFAULT_FROM_EMAIL,
        [collaborator_email],
        fail_silently=True,
        html_message=html_email(body_html),
    )
