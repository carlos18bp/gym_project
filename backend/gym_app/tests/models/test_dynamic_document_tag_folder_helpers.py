import os
from datetime import datetime, timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from gym_app.models.dynamic_document import (
    Tag,
    DynamicDocument,
    DocumentFolder,
    RecentDocument,
    document_version_path,
    letterhead_image_path,
    document_letterhead_template_path,
)
import gym_app.models.dynamic_document as dynamic_document_module
from gym_app.models.user import User


pytestmark = pytest.mark.django_db

FIXED_NOW = timezone.make_aware(datetime(2026, 1, 15, 10, 0, 0))


@pytest.fixture
def user_factory():
    def create_user(email, role="client", is_gym_lawyer=False):
        return User.objects.create_user(
            email=email,
            password="testpassword",
            role=role,
            is_gym_lawyer=is_gym_lawyer,
        )

    return create_user


@pytest.fixture
def document_factory():
    def create_document(created_by, **kwargs):
        return DynamicDocument.objects.create(
            title=kwargs.pop("title", "Doc"),
            content=kwargs.pop("content", "<p>x</p>"),
            state=kwargs.pop("state", "Draft"),
            created_by=created_by,
            assigned_to=kwargs.pop("assigned_to", None),
            is_public=kwargs.pop("is_public", False),
        )

    return create_document


@pytest.fixture
def fixed_uuid(monkeypatch):
    class DummyUUID:
        hex = "deadbeef"

    monkeypatch.setattr(dynamic_document_module.uuid, "uuid4", lambda: DummyUUID())
    return "deadbeef"


def test_tag_str_returns_name(user_factory):
    creator = user_factory("lawyer@example.com", role="lawyer")
    tag = Tag.objects.create(name="Important", color_id=2, created_by=creator)

    assert str(tag) == "Important"


def test_tag_ordering_by_name(user_factory):
    creator = user_factory("lawyer@example.com", role="lawyer")
    Tag.objects.create(name="B", color_id=1, created_by=creator)
    Tag.objects.create(name="A", color_id=1, created_by=creator)

    names = list(Tag.objects.values_list("name", flat=True))

    assert names == ["A", "B"]


def test_tag_unique_name(user_factory):
    creator = user_factory("lawyer@example.com", role="lawyer")
    Tag.objects.create(name="Unique", color_id=1, created_by=creator)

    with pytest.raises(IntegrityError) as exc_info:
        with transaction.atomic():
            Tag.objects.create(name="Unique", color_id=2, created_by=creator)
    assert exc_info.value is not None
    assert Tag.objects.filter(name="Unique").count() == 1


def test_tag_created_by_optional():
    tag = Tag.objects.create(name="NoOwner")

    assert tag.created_by is None


def test_tag_color_id_default():
    tag = Tag.objects.create(name="DefaultColor")

    assert tag.color_id == 0


def test_document_version_path_uses_document_id_and_uuid(fixed_uuid):
    class DummyDocument:
        id = 42

    class DummyInstance:
        document = DummyDocument()

    path = document_version_path(DummyInstance(), "file.PDF")

    assert path == os.path.join("document_versions", "42", f"{fixed_uuid}.PDF")


def test_letterhead_image_path_uses_instance_id_and_lowercase_ext(fixed_uuid):
    class DummyInstance:
        id = 7

    path = letterhead_image_path(DummyInstance(), "Header.PNG")

    assert path == os.path.join("letterheads", "7", f"letterhead_{fixed_uuid}.png")


def test_document_letterhead_template_path_uses_instance_id_and_lowercase_ext(fixed_uuid):
    class DummyInstance:
        id = 5

    path = document_letterhead_template_path(DummyInstance(), "Template.DOCX")

    assert path == os.path.join(
        "document_letterhead_templates",
        "5",
        f"document_letterhead_template_{fixed_uuid}.docx",
    )


def test_document_folder_str(user_factory):
    owner = user_factory("owner@example.com")
    folder = DocumentFolder.objects.create(name="Folder", owner=owner)

    assert str(folder) == f"Folder ({owner.email})"


def test_document_folder_ordering_by_created_at(user_factory):
    owner = user_factory("owner@example.com")
    older_time = FIXED_NOW - timedelta(days=1)
    newer_time = FIXED_NOW

    older_folder = DocumentFolder.objects.create(name="Older", owner=owner)
    newer_folder = DocumentFolder.objects.create(name="Newer", owner=owner)

    DocumentFolder.objects.filter(pk=older_folder.pk).update(created_at=older_time)
    DocumentFolder.objects.filter(pk=newer_folder.pk).update(created_at=newer_time)

    ordered = list(DocumentFolder.objects.all())

    assert ordered[0].id == newer_folder.id
    assert ordered[1].id == older_folder.id


def test_document_folder_add_document(user_factory, document_factory):
    owner = user_factory("owner@example.com")
    document = document_factory(created_by=owner)
    folder = DocumentFolder.objects.create(name="Folder", owner=owner)

    folder.documents.add(document)

    assert folder.documents.count() == 1
    assert folder.documents.first().id == document.id


def test_document_folder_remove_document(user_factory, document_factory):
    owner = user_factory("owner@example.com")
    document = document_factory(created_by=owner)
    folder = DocumentFolder.objects.create(name="Folder", owner=owner)

    folder.documents.add(document)
    folder.documents.remove(document)

    assert folder.documents.count() == 0


def test_document_folder_owner_required():
    with pytest.raises(IntegrityError) as exc_info:
        with transaction.atomic():
            DocumentFolder.objects.create(name="NoOwner")
    assert exc_info.value is not None
    assert DocumentFolder.objects.filter(name="NoOwner").count() == 0


def test_document_folder_color_default(user_factory):
    owner = user_factory("owner@example.com")
    folder = DocumentFolder.objects.create(name="DefaultColor", owner=owner)

    assert folder.color_id == 0


def test_recent_document_ordering_by_last_visited(user_factory, document_factory):
    user = user_factory("recent@example.com")
    older_doc = document_factory(created_by=user, title="Older")
    newer_doc = document_factory(created_by=user, title="Newer")

    older_recent = RecentDocument.objects.create(user=user, document=older_doc)
    newer_recent = RecentDocument.objects.create(user=user, document=newer_doc)

    older_time = FIXED_NOW - timedelta(days=1)
    newer_time = FIXED_NOW
    RecentDocument.objects.filter(pk=older_recent.pk).update(last_visited=older_time)
    RecentDocument.objects.filter(pk=newer_recent.pk).update(last_visited=newer_time)

    ordered = list(RecentDocument.objects.all())

    assert ordered[0].id == newer_recent.id
    assert ordered[1].id == older_recent.id


def test_dynamic_document_delete_removes_folder_relation(user_factory, document_factory):
    owner = user_factory("owner@example.com")
    document = document_factory(created_by=owner)
    folder = DocumentFolder.objects.create(name="Folder", owner=owner)
    folder.documents.add(document)

    document.delete()
    folder.refresh_from_db()

    assert not DynamicDocument.objects.filter(pk=document.pk).exists()
    assert DocumentFolder.objects.filter(pk=folder.pk).exists()
    assert folder.documents.count() == 0


def test_is_lawyer_true_for_role_lawyer(user_factory, document_factory):
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    assert document.is_lawyer(lawyer) is True


def test_is_lawyer_true_for_gym_lawyer(user_factory, document_factory):
    gym_lawyer = user_factory("gym@example.com", is_gym_lawyer=True)
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    assert document.is_lawyer(gym_lawyer) is True


def test_is_lawyer_false_for_client(user_factory, document_factory):
    client = user_factory("client@example.com")
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    assert document.is_lawyer(client) is False


def test_get_user_permission_level_prefers_lawyer_over_owner(user_factory, document_factory):
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    document = document_factory(created_by=lawyer)

    assert document.get_user_permission_level(lawyer) == "lawyer"
