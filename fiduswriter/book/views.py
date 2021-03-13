import json
import time

from django.http import JsonResponse, HttpRequest
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth.models import User
from django.utils.translation import ugettext as _
from django.conf import settings
from django.core.mail import send_mail
from django.views.decorators.http import require_POST

from base.decorators import ajax_required
from document.helpers.serializers import PythonWithURLSerializer
from .models import Book, BookAccessRight, Chapter, BookStyle

from document.models import AccessRight
from document.views import documents_list
from usermedia.models import UserImage

from user.util import get_user_avatar_url

from django.core.serializers.python import Serializer

from django.db.models import Q


class SimpleSerializer(Serializer):

    def end_object(self, obj):
        self._current['id'] = obj._get_pk_val()
        self.objects.append(self._current)


serializer = SimpleSerializer()


def get_accessrights(ars):
    ret = []
    for ar in ars:
        ret.append({
            'book_id': ar.book.id,
            'user': {
                'id': ar.user.id,
                'name': ar.user.readable_name,
                'avatar': get_user_avatar_url(ar.user),
            },
            'rights': ar.rights,
        })
    return ret


@login_required
@require_POST
@ajax_required
def list(request):
    response = {}
    status = 200
    response['documents'] = documents_list(request)
    books = Book.objects.filter(
        Q(owner=request.user) |
        Q(bookaccessright__user=request.user)
    ).distinct().order_by('-updated')
    response['books'] = []
    for book in books:
        if book.owner == request.user:
            access_right = 'write'
            path = book.path
        else:
            access_right = BookAccessRight.objects.get(
                user=request.user,
                book=book
            ).rights
            path = access_right.path
        added = time.mktime(book.added.utctimetuple())
        updated = time.mktime(book.updated.utctimetuple())
        is_owner = False
        if book.owner == request.user:
            is_owner = True
        chapters = []
        for chapter in book.chapter_set.all():
            chapters.append({'text': chapter.text_id,
                             'number': chapter.number,
                             'part': chapter.part,
                             'title': chapter.text.title})
            chapter_updated = time.mktime(chapter.text.updated.utctimetuple())
            if chapter_updated > updated:
                updated = chapter_updated
        book_data = {
            'id': book.id,
            'title': book.title,
            'path': path,
            'is_owner': is_owner,
            'owner': {
                'id': book.owner.id,
                'name': book.owner.readable_name,
                'avatar': get_user_avatar_url(book.owner)
            },
            'added': added,
            'updated': updated,
            'rights': access_right,
            'chapters': chapters,
            'metadata': book.metadata,
            'settings': book.settings
        }
        if book.cover_image:
            image = book.cover_image
            book_data['cover_image'] = image.id
            field_obj = {
                'id': image.id,
                'added': time.mktime(image.added.utctimetuple()) * 1000,
                'checksum': image.checksum,
                'file_type': image.file_type,
                'title': '',
                'cats': '',
                'image': image.image.url
            }
            if image.thumbnail:
                field_obj['thumbnail'] = image.thumbnail.url
                field_obj['height'] = image.height
                field_obj['width'] = image.width
            book_data['cover_image_data'] = field_obj
        response['books'].append(book_data)
    response['team_members'] = []
    for team_member in request.user.leader.all():
        response['team_members'].append({
            'id': team_member.member.id,
            'name': team_member.member.readable_name,
            'avatar': get_user_avatar_url(team_member.member),
        })
    response['access_rights'] = get_accessrights(
        BookAccessRight.objects.filter(book__owner=request.user))
    serializer = PythonWithURLSerializer()
    book_styles = serializer.serialize(
        BookStyle.objects.all(),
        use_natural_foreign_keys=True,
        fields=['title', 'slug', 'contents', 'bookstylefile_set']
    )
    response['styles'] = [obj['fields'] for obj in book_styles]
    return JsonResponse(
        response,
        status=status
    )


def set_chapters(book, chapters, user):
    book.chapter_set.all().delete()
    for chapter in chapters:
        new_chapter = Chapter(
            book=book,
            text_id=chapter['text'],
            number=chapter['number'],
            part=chapter['part'])
        new_chapter.save()
        # If the current user is the owner of the chapter-document, make sure
        # that everyone with access to the book gets at least read access.
        if user == new_chapter.text.owner:
            for bar in BookAccessRight.objects.filter(book=book):
                if len(
                    new_chapter.text.accessright_set.filter(
                        user=bar.user)) == 0:
                    AccessRight.objects.create(
                        document_id=new_chapter.text.id,
                        user_id=bar.user.id,
                        rights='read',
                    )
            if user != book.owner and len(
                new_chapter.text.accessright_set.filter(
                    user=book.owner)) == 0:
                AccessRight.objects.create(
                    document_id=new_chapter.text.id,
                    user_id=book.owner.id,
                    rights='read',
                )
    return


@login_required
@require_POST
@ajax_required
def copy(request):
    # Copy a book
    book_id = request.POST['id']
    book = Book.objects.get(id=book_id)
    if (
        book.owner != request.user and not
        book.bookaccessright_set.filter(
            user=request.user
        ).exists()
    ):
        return JsonResponse({}, status=405)
    path = request.POST['path']
    if len(path):
        counter = 0
        base_path = path
        while (
            Book.objects.filter(owner=request.user, path=path).first() or
            BookAccessRight.objects.filter(
                user=request.user,
                path=path
            ).first()
        ):
            counter += 1
            path = base_path + ' ' + str(counter)
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
    response['id'] = book.id
    response['path'] = book.path
    return JsonResponse(
        response,
        status=status
    )


@login_required
@require_POST
@ajax_required
def save(request):
    response = {}
    status = 403
    book_obj = json.loads(request.POST['book'])
    chapters = book_obj.pop('chapters')
    has_book_write_access = False
    if book_obj['id'] == 0:
        # We are dealing with a new book that still has not obtained an
        # ID.
        book = Book()
        book.owner = request.user
        book.path = book_obj['path']
        has_book_write_access = True
    else:
        book = Book.objects.get(id=book_obj['id'])
        if book.owner == request.user:
            has_book_write_access = True
            book.updated = timezone.now()
            book.path = book_obj['path']
        else:
            access_right = book.bookaccessright_set.filter(
                user=request.user,
                rights='write'
            ).first()
            if access_right:
                has_book_write_access = True
                book.updated = timezone.now()
                access_right.path = book_obj['path']
                access_right.save()
    has_coverimage_access = False
    if 'cover_image' not in book_obj:
        book.cover_image = None
        has_coverimage_access = True
    elif book_obj['cover_image'] is False:
        book.cover_image = None
        has_coverimage_access = True
    elif book_obj['cover_image'] == book.cover_image_id:
        has_coverimage_access = True
    elif (
        book_obj['cover_image'] == book.cover_image or
        UserImage.objects.filter(
            owner=request.user,
            image_id=book_obj['cover_image']
        ).exists()
    ):
        book.cover_image_id = book_obj['cover_image']
        has_coverimage_access = True
    if has_book_write_access and has_coverimage_access:
        book.metadata = json.dumps(book_obj['metadata'])
        book.settings = json.dumps(book_obj['settings'])
        book.title = book_obj['title']
        book.save()
        status = 201
        response['id'] = book.id
        response['added'] = time.mktime(book.added.utctimetuple())
        response['updated'] = time.mktime(book.updated.utctimetuple())
        set_chapters(
            book, chapters, request.user)
    return JsonResponse(
        response,
        status=status
    )


@login_required
@require_POST
@ajax_required
def delete(request):
    response = {}
    status = 405
    book_id = int(request.POST['id'])
    book = Book.objects.filter(pk=book_id, owner=request.user).first()
    if book:
        image = book.cover_image
        book.delete()
        if image and image.is_deletable():
            image.delete()
        status = 200
    return JsonResponse(
        response,
        status=status
    )


@login_required
@ajax_required
@require_POST
def move(request):
    response = {}
    status = 200
    book_id = int(request.POST['id'])
    path = request.POST['path']
    book = Book.objects.filter(pk=book_id).first()
    if not book:
        response['done'] = False
    elif book.owner == request.user:
        book.path = path
        book.save(update_fields=['path', ])
        response['done'] = True
    else:
        access_right = BookAccessRight.objects.filter(
            book=book,
            user=request.user
        ).first()
        if not access_right:
            response['done'] = False
        else:
            access_right.path = path
            access_right.save()
            response['done'] = True
    return JsonResponse(
        response,
        status=status
    )


def send_share_notification(request, book_id, collaborator_id, right):
    owner = request.user.readable_name
    book = Book.objects.get(id=book_id)
    collaborator = User.objects.get(id=collaborator_id)
    collaborator_name = collaborator.readable_name
    collaborator_email = collaborator.email
    book_title = book.title
    if len(book_title) == 0:
        book_title = _('Untitled')
    link = HttpRequest.build_absolute_uri(request, '/book/')
    message_body = _(
        (
            'Hey %(collaborator_name)s,\n%(owner)s has shared the book '
            '\'%(book)s\' on Fidus Writer with you and given you %(right)s '
            'access rights.\nFind the book in your book overview: %(link)s'
        )
    ) % {
        'owner': owner,
        'right': right,
        'collaborator_name': collaborator_name,
        'link': link,
        'book': book_title
    }
    send_mail(
        _('Book shared:') +
        ' ' +
        book_title,
        message_body,
        settings.DEFAULT_FROM_EMAIL,
        [collaborator_email],
        fail_silently=True)


def send_share_upgrade_notification(request, book_id, collaborator_id):
    owner = request.user.readable_name
    book = Book.objects.get(id=book_id)
    collaborator = User.objects.get(id=collaborator_id)
    collaborator_name = collaborator.readable_name
    collaborator_email = collaborator.email
    link = HttpRequest.build_absolute_uri(request, '/book/')
    message_body = _(
        (
            'Hey %(collaborator_name)s,\n%(owner)s has given you write access '
            'rights to the book \'%(book)s\' on Fidus Writer.\nFind the book '
            'in your book overview: %(link)s'
        )
    ) % {
        'owner': owner,
        'collaborator_name': collaborator_name,
        'link': link,
        'book': book.title
    }
    send_mail(
        _('Fidus Writer book write access'),
        message_body,
        settings.DEFAULT_FROM_EMAIL,
        [collaborator_email],
        fail_silently=True)


@login_required
@require_POST
@ajax_required
@transaction.atomic
def access_right_save(request):
    response = {}
    tgt_books = request.POST.getlist('books[]')
    tgt_users = request.POST.getlist('collaborators[]')
    tgt_rights = request.POST.getlist('rights[]')
    for tgt_book in tgt_books:
        book_id = int(tgt_book)
        try:
            book = Book.objects.get(pk=book_id, owner=request.user)
        except ObjectDoesNotExist:
            continue
        x = 0
        for tgt_user in tgt_users:
            collaborator_id = int(tgt_user)
            try:
                tgt_right = tgt_rights[x]
            except IndexError:
                tgt_right = 'read'
            if tgt_right == 'delete':
                # Status 'delete' means the access right is marked for
                # deletion.
                access_right = BookAccessRight.objects.filter(
                    book_id=book_id, user_id=collaborator_id
                ).first()
                if access_right:
                    access_right.delete()
            else:
                try:
                    access_right = BookAccessRight.objects.get(
                        book_id=book_id, user_id=collaborator_id)
                    if access_right.rights != tgt_right:
                        access_right.rights = tgt_right
                        if tgt_right == 'write':
                            send_share_upgrade_notification(
                                request, book_id, collaborator_id)
                except ObjectDoesNotExist:
                    access_right = BookAccessRight.objects.create(
                        book_id=book_id,
                        user_id=collaborator_id,
                        rights=tgt_right,
                    )
                    send_share_notification(
                        request, book_id, collaborator_id, tgt_right)
                access_right.save()
                for text in book.chapters.all():
                    # If one shares a book with another user and that user
                    # has no access rights on the chapters that belong to
                    # the current user, give read access to the chapter
                    # documents to the collaborator.
                    if text.owner == request.user and len(
                        text.accessright_set.filter(
                            user_id=collaborator_id
                        )
                    ) == 0:
                        AccessRight.objects.create(
                            document_id=text.id,
                            user_id=collaborator_id,
                            rights='read',
                        )
            x += 1
    response['access_rights'] = get_accessrights(
        BookAccessRight.objects.filter(book__owner=request.user))
    status = 201
    return JsonResponse(
        response,
        status=status
    )
