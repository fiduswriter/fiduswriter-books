from django.db.models.signals import pre_delete
from django.dispatch import receiver

from user.models import UserInvite
from . import models


@receiver(pre_delete, sender=UserInvite)
def connect_book_invites(sender, instance, using, **kwargs):
    if not instance._apply or not instance.to:
        # Don't apply
        return
    for right in models.BookAccessRight.objects.filter(
        holder_type__model="userinvite", holder_id=instance.id
    ):
        old_ar = models.BookAccessRight.objects.filter(
            holder_type__model="user",
            holder_id=instance.to.id,
            book=right.book,
        ).first()
        if old_ar:
            # If the user already has rights, we should only be upgrading
            # them, not downgrade.
            if right.rights == "read":
                pass
            elif old_ar.rights == "write":
                pass
            else:
                old_ar.rights = right.rights
                old_ar.save()
        elif right.book.owner == instance.to:
            pass
        else:
            right.holder_obj = instance.to
            right.save()
