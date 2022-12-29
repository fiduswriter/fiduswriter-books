import json
import time

from django.http import JsonResponse, HttpRequest
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_POST
from django.db.models import Q, Prefetch

from base.decorators import ajax_required
from document.helpers.serializers import PythonWithURLSerializer
from .models import Book, BookAccessRight, Chapter, BookStyle
from . import emails

from user.helpers import Avatars

from document.models import AccessRight
from document.views import documents_list
from usermedia.models import UserImage
from user.models import UserInvite


@login_required
@ajax_required
@require_POST
def get_access_rights(request):
    response = {}
    status = 200
    avatars = Avatars()
    ar_qs = BookAccessRight.objects.filter(book__owner=request.user)
    book_ids = request.POST.getlist("book_ids[]")
    if len(book_ids) > 0:
        ar_qs = ar_qs.filter(book_id__in=book_ids)
    access_rights = []
    for ar in ar_qs:
        if ar.holder_type.model == "user":
            avatar = avatars.get_url(ar.holder_obj)
        else:
            avatar = None
        access_rights.append(
            {
                "book_id": ar.book.id,
                "rights": ar.rights,
                "holder": {
                    "id": ar.holder_id,
                    "type": ar.holder_type.model,
                    "name": ar.holder_obj.readable_name,
                    "avatar": avatar,
                },
            }
        )
    response["access_rights"] = access_rights
    return JsonResponse(response, status=status)


@login_required
@require_POST
@ajax_required
def list(request):
    response = {}
    status = 200
    avatars = Avatars()
    response["documents"] = documents_list(request)
    books = (
        Book.objects.filter(
            Q(owner=request.user)
            | Q(
                bookaccessright__holder_id=request.user.id,
                bookaccessright__holder_type__model="user",
            )
        )
        .select_related("owner")
        .prefetch_related(
            Prefetch(
                "chapter_set",
                queryset=Chapter.objects.select_related("text").only(
                    "id",
                    "number",
                    "part",
                    "text_id",
                    "text__title",
                    "text__updated",
                ),
            )
        )
        .only(
            "id",
            "title",
            "path",
            "added",
            "updated",
            "metadata",
            "settings",
            "cover_image",
            "owner_id",
            "owner__first_name",
            "owner__last_name",
            "owner__username",
        )
        .order_by("-updated")
        .distinct()
    )
    response["books"] = []
    for book in books:
        if book.owner_id == request.user.id:
            access_right = "write"
            path = book.path
        else:
            access_right_object = BookAccessRight.objects.get(
                holder_id=request.user.id, holder_type__model="user", book=book
            )
            access_right = access_right_object.rights
            path = access_right_object.path
        added = time.mktime(book.added.utctimetuple())
        updated = time.mktime(book.updated.utctimetuple())
        is_owner = False
        if book.owner_id == request.user.id:
            is_owner = True
        chapters = []
        for chapter in book.chapter_set.all():
            chapters.append(
                {
                    "text": chapter.text_id,
                    "number": chapter.number,
                    "part": chapter.part,
                    "title": chapter.text.title,
                }
            )
            chapter_updated = time.mktime(chapter.text.updated.utctimetuple())
            if chapter_updated > updated:
                updated = chapter_updated
        book_data = {
            "id": book.id,
            "title": book.title,
            "path": path,
            "is_owner": is_owner,
            "owner": {
                "id": book.owner_id,
                "name": book.owner.readable_name,
                "avatar": avatars.get_url(book.owner),
            },
            "added": added,
            "updated": updated,
            "rights": access_right,
            "chapters": chapters,
            "metadata": book.metadata,
            "settings": book.settings,
        }
        if book.cover_image:
            image = book.cover_image
            book_data["cover_image"] = image.id
            field_obj = {
                "id": image.id,
                "added": time.mktime(image.added.utctimetuple()) * 1000,
                "checksum": image.checksum,
                "file_type": image.file_type,
                "title": "",
                "cats": "",
                "image": image.image.url,
            }
            if image.thumbnail:
                field_obj["thumbnail"] = image.thumbnail.url
                field_obj["height"] = image.height
                field_obj["width"] = image.width
            book_data["cover_image_data"] = field_obj
        response["books"].append(book_data)
    response["contacts"] = []
    for contact in request.user.contacts.all():
        contact_object = {
            "id": contact.id,
            "name": contact.readable_name,
            "username": contact.get_username(),
            "avatar": avatars.get_url(contact),
            "type": "user",
        }
        response["contacts"].append(contact_object)
    for contact in request.user.invites_by.all():
        contact_object = {
            "id": contact.id,
            "name": contact.username,
            "username": contact.username,
            "avatar": None,
            "type": "userinvite",
        }
        response["contacts"].append(contact_object)
    serializer = PythonWithURLSerializer()
    book_styles = serializer.serialize(
        BookStyle.objects.all(),
        use_natural_foreign_keys=True,
        fields=["title", "slug", "contents", "bookstylefile_set"],
    )
    response["styles"] = [obj["fields"] for obj in book_styles]

    return JsonResponse(response, status=status)


def set_chapters(book, chapters, user):
    changed = False
    current_chapters = book.chapter_set.all().order_by("number")
    if len(current_chapters) != len(chapters):
        changed = True
    else:
        for i, cur_chap in enumerate(current_chapters):
            if (
                cur_chap.text_id != chapters[i]["text"]
                or cur_chap.number != chapters[i]["number"]
                or cur_chap.part != chapters[i]["part"]
            ):
                changed = True
                break
    if not changed:
        return
    current_chapters.delete()
    for chapter in chapters:
        new_chapter = Chapter(
            book=book,
            text_id=chapter["text"],
            number=chapter["number"],
            part=chapter["part"],
        )
        new_chapter.save()
        # If the current user is the owner of the chapter-document, make sure
        # that everyone with access to the book gets at least read access.
        if user == new_chapter.text.owner:
            for bar in BookAccessRight.objects.filter(book=book):
                if (
                    len(
                        new_chapter.text.accessright_set.filter(
                            holder_id=bar.holder_id,
                            holder_type=bar.holder_type,
                        )
                    )
                    == 0
                ):
                    AccessRight.objects.create(
                        document_id=new_chapter.text.id,
                        holder_id=bar.holder_id,
                        holder_type=bar.holder_type,
                        rights="read",
                    )
            if (
                user != book.owner
                and len(
                    new_chapter.text.accessright_set.filter(user=book.owner)
                )
                == 0
            ):
                AccessRight.objects.create(
                    document_id=new_chapter.text.id,
                    user_id=book.owner.id,
                    rights="read",
                )
        book.save(force_update=True)
    return


@login_required
@require_POST
@ajax_required
def copy(request):
    # Copy a book
    book_id = request.POST["id"]
    book = Book.objects.get(id=book_id)
    if (
        book.owner != request.user
        and not book.bookaccessright_set.filter(
            holder_type__model="user", holder_id=request.user.id
        ).exists()
    ):
        return JsonResponse({}, status=405)
    path = request.POST["path"]
    if len(path):
        counter = 0
        base_path = path
        while (
            Book.objects.filter(owner=request.user, path=path).first()
            or BookAccessRight.objects.filter(
                holder_id=request.user.id, holder_type__model="user", path=path
            ).first()
        ):
            counter += 1
            path = f"{base_path} {counter}"
    response = {}
    status = 201
    book.id = None
    book.owner = request.user
    book.path = path
    book.save()
    # Copy chapters
    for chapter in Chapter.objects.filter(book_id=book_id):
        chapter.id = None
        chapter.book_id = book.id
        chapter.save()
    response["id"] = book.id
    response["path"] = book.path
    return JsonResponse(response, status=status)


@login_required
@require_POST
@ajax_required
def save(request):
    response = {}
    status = 403
    book_obj = json.loads(request.POST["book"])
    chapters = book_obj.pop("chapters")
    has_book_write_access = False
    if book_obj["id"] == 0:
        # We are dealing with a new book that still has not obtained an
        # ID.
        book = Book()
        book.owner = request.user
        book.path = book_obj["path"]
        has_book_write_access = True
    else:
        book = Book.objects.get(id=book_obj["id"])
        if book.owner == request.user:
            has_book_write_access = True
            book.path = book_obj["path"]
        else:
            access_right = book.bookaccessright_set.filter(
                holder_type__model="user",
                holder_id=request.user.id,
                rights="write",
            ).first()
            if access_right:
                has_book_write_access = True
                access_right.path = book_obj["path"]
                access_right.save()
    has_coverimage_access = False
    if "cover_image" not in book_obj:
        book.cover_image = None
        has_coverimage_access = True
    elif book_obj["cover_image"] is False:
        book.cover_image = None
        has_coverimage_access = True
    elif book_obj["cover_image"] == book.cover_image_id:
        has_coverimage_access = True
    elif (
        book_obj["cover_image"] == book.cover_image
        or UserImage.objects.filter(
            owner=request.user, image_id=book_obj["cover_image"]
        ).exists()
    ):
        book.cover_image_id = book_obj["cover_image"]
        has_coverimage_access = True
    if has_book_write_access and has_coverimage_access:
        book.metadata = book_obj["metadata"]
        book.settings = book_obj["settings"]
        book.title = book_obj["title"]
        book.save()
        status = 201
        response["id"] = book.id
        response["added"] = time.mktime(book.added.utctimetuple())
        response["updated"] = time.mktime(book.updated.utctimetuple())
        set_chapters(book, chapters, request.user)
    return JsonResponse(response, status=status)


@login_required
@require_POST
@ajax_required
def delete(request):
    response = {}
    status = 405
    book_id = int(request.POST["id"])
    book = Book.objects.filter(pk=book_id, owner=request.user).first()
    if book:
        image = book.cover_image
        book.delete()
        if image and image.is_deletable():
            image.delete()
        status = 200
    return JsonResponse(response, status=status)


@login_required
@ajax_required
@require_POST
def move(request):
    response = {}
    status = 200
    book_id = int(request.POST["id"])
    path = request.POST["path"]
    book = Book.objects.filter(pk=book_id).first()
    if not book:
        response["done"] = False
    elif book.owner == request.user:
        book.path = path
        book.save(
            update_fields=[
                "path",
            ]
        )
        response["done"] = True
    else:
        access_right = BookAccessRight.objects.filter(
            book=book, holder_id=request.user.id, holder_type__model="user"
        ).first()
        if not access_right:
            response["done"] = False
        else:
            access_right.path = path
            access_right.save()
            response["done"] = True
    return JsonResponse(response, status=status)


@login_required
@require_POST
@ajax_required
@transaction.atomic
def save_access_rights(request):
    User = get_user_model()
    response = {}
    book_ids = json.loads(request.POST["book_ids"])
    rights = json.loads(request.POST["access_rights"])
    for book_id in book_ids:
        book = Book.objects.filter(pk=book_id, owner=request.user).first()
        if not book:
            continue
        for right in rights:
            if right["rights"] == "delete":
                # Status 'delete' means the access right is marked for
                # deletion.
                BookAccessRight.objects.filter(
                    **{
                        "book_id": book_id,
                        "holder_id": right["holder"]["id"],
                        "holder_type__model": right["holder"]["type"],
                    }
                ).delete()
            else:
                owner = request.user.readable_name
                link = HttpRequest.build_absolute_uri(request, "/books/")
                access_right = BookAccessRight.objects.filter(
                    **{
                        "book_id": book_id,
                        "holder_id": right["holder"]["id"],
                        "holder_type__model": right["holder"]["type"],
                    }
                ).first()
                book_title = book.title
                if access_right:
                    if access_right.rights != right["rights"]:
                        access_right.rights = right["rights"]
                        if right["holder"]["type"] == "user":
                            collaborator = User.objects.get(
                                id=right["holder"]["id"]
                            )
                            collaborator_name = collaborator.readable_name
                            collaborator_email = collaborator.email
                            emails.send_share_notification(
                                book_title,
                                owner,
                                link,
                                collaborator_name,
                                collaborator_email,
                                right["rights"],
                                True,
                            )
                else:
                    # Make the shared path "/filename" or ""
                    path = "/%(last_path_part)s" % {
                        "last_path_part": book.path.split("/").pop()
                    }
                    if len(path) == 1:
                        path = ""
                    if right["holder"]["type"] == "userinvite":
                        holder = UserInvite.objects.get(
                            id=right["holder"]["id"]
                        )
                    else:
                        holder = User.objects.get(id=right["holder"]["id"])
                    access_right = BookAccessRight.objects.create(
                        book_id=book_id,
                        holder_obj=holder,
                        rights=right["rights"],
                        path=path,
                    )
                    if right["holder"]["id"] == "user":
                        collaborator_name = holder.readable_name
                        collaborator_email = holder.email
                        emails.send_share_notification(
                            book_title,
                            owner,
                            link,
                            collaborator_name,
                            collaborator_email,
                            right["rights"],
                            False,
                        )
                access_right.save()
                for text in book.chapters.all():
                    # If one shares a book with another user and that user
                    # has no access rights on the chapters that belong to
                    # the current user, give read access to the chapter
                    # documents to the collaborator.
                    if (
                        text.owner == request.user
                        and not text.accessright_set.filter(
                            holder_type__model=access_right.holder_type.model,
                            holder_id=access_right.holder_id,
                        ).first()
                    ):
                        AccessRight.objects.create(
                            document_id=text.id,
                            holder_id=access_right.holder_id,
                            holder_type=access_right.holder_type,
                            rights="read",
                        )
    status = 201
    return JsonResponse(response, status=status)
