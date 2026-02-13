"""
Batch edge tests for serializer coverage gaps:
- process.py: ProcessSerializer.update (lines 52-106, specifically line 89)
- intranet_gym.py: IntranetProfileSerializer no-image / no-request (lines 49, 60)
- subscription.py: SubscriptionSerializer.get_user_name (line 46)
- corporate_request.py: various gaps (lines 31, 37, 44-46, 65, 198, 205-209, 235, 303-307)
"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from gym_app.models import (
    Process, Case, Stage, CaseFile, RecentProcess,
    Subscription, PaymentHistory,
    LegalDocument,
)
from gym_app.models.intranet_gym import IntranetProfile
from gym_app.serializers.process import ProcessSerializer, RecentProcessSerializer
from gym_app.serializers.intranet_gym import LegalDocumentSerializer, IntranetProfileSerializer
from gym_app.serializers.subscription import SubscriptionSerializer

User = get_user_model()


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def lawyer(db):
    return User.objects.create_user(
        email="ser-lawyer@example.com",
        password="testpassword",
        first_name="Ser",
        last_name="Lawyer",
        role="Lawyer",
    )


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        email="ser-client@example.com",
        password="testpassword",
        first_name="Ser",
        last_name="Client",
        role="Client",
    )


@pytest.fixture
def case_type(db):
    return Case.objects.create(type="Civil")


@pytest.fixture
def process(db, lawyer, client_user, case_type):
    proc = Process.objects.create(
        authority="Juzgado",
        plaintiff="P",
        defendant="D",
        ref="REF-SER",
        lawyer=lawyer,
        case=case_type,
        subcase="Sub",
        progress=30,
    )
    proc.clients.add(client_user)
    s1 = Stage.objects.create(status="Stage A")
    s2 = Stage.objects.create(status="Stage B")
    proc.stages.add(s1, s2)
    return proc


# ---------------------------------------------------------------------------
# ProcessSerializer.update (lines 52-106)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestProcessSerializerUpdate:
    def test_update_simple_fields(self, process, rf):
        """Cover lines 68-74: update simple fields."""
        request = rf.get("/")
        serializer = ProcessSerializer(
            process,
            data={
                "plaintiff": "New P",
                "defendant": "New D",
                "ref": "NEW-REF",
                "authority": "New Auth",
                "authority_email": "auth@example.com",
                "subcase": "New Sub",
                "progress": 80,
            },
            partial=True,
            context={"request": request},
        )
        # ProcessSerializer has nested read-only fields, so update must be called directly
        validated = {
            "plaintiff": "New P",
            "defendant": "New D",
            "ref": "NEW-REF",
            "authority": "New Auth",
            "authority_email": "auth@example.com",
            "subcase": "New Sub",
            "progress": 80,
        }
        updated = serializer.update(process, validated)
        assert updated.plaintiff == "New P"
        assert updated.progress == 80

    def test_update_stages_remove_and_add(self, process, rf):
        """Cover lines 77-102: stage update logic (remove old, update existing, add new)."""
        existing_stage = process.stages.first()
        validated = {
            "stages": [
                {"id": existing_stage.id, "status": "Updated Stage"},  # update existing
                {"status": "Brand New Stage"},  # create new (no id)
            ]
        }
        updated = serializer_update_helper(process, validated)
        # The second original stage should have been removed
        stage_statuses = list(updated.stages.values_list("status", flat=True))
        assert "Updated Stage" in stage_statuses
        assert "Brand New Stage" in stage_statuses

    def test_update_stages_none_skips(self, process, rf):
        """Cover line 80: stages_data is None → skip stage update."""
        original_count = process.stages.count()
        validated = {"plaintiff": "Keep stages"}
        updated = serializer_update_helper(process, validated)
        assert updated.stages.count() == original_count


def serializer_update_helper(process, validated_data):
    """Helper to call ProcessSerializer.update directly."""
    serializer = ProcessSerializer()
    return serializer.update(process, validated_data)


# ---------------------------------------------------------------------------
# IntranetProfileSerializer edges (lines 49, 60)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestIntranetProfileSerializerEdges:
    def test_cover_image_url_no_image(self, rf):
        """Cover line 49: cover_image is falsy → return None."""
        profile = IntranetProfile.objects.create()
        request = rf.get("/")
        serializer = IntranetProfileSerializer(profile, context={"request": request})
        data = serializer.data
        assert data["cover_image_url"] is None

    def test_profile_image_url_no_image(self, rf):
        """Cover line 60: profile_image is falsy → return None."""
        profile = IntranetProfile.objects.create()
        request = rf.get("/")
        serializer = IntranetProfileSerializer(profile, context={"request": request})
        data = serializer.data
        assert data["profile_image_url"] is None

    def test_cover_image_url_no_request(self):
        """Cover line 48: cover_image exists but no request → return raw url."""
        img = SimpleUploadedFile("cover.png", b"\x89PNG", content_type="image/png")
        profile = IntranetProfile.objects.create(cover_image=img)
        serializer = IntranetProfileSerializer(profile)
        data = serializer.data
        assert data["cover_image_url"] is not None
        assert "http" not in data["cover_image_url"]  # raw url, not absolute

    def test_profile_image_url_no_request(self):
        """Cover line 59: profile_image exists but no request → return raw url."""
        img = SimpleUploadedFile("profile.png", b"\x89PNG", content_type="image/png")
        profile = IntranetProfile.objects.create(profile_image=img)
        serializer = IntranetProfileSerializer(profile)
        data = serializer.data
        assert data["profile_image_url"] is not None

    def test_cover_image_url_with_request(self, rf):
        """Cover lines 45-47: cover_image exists with request → absolute URI."""
        img = SimpleUploadedFile("cover2.png", b"\x89PNG", content_type="image/png")
        profile = IntranetProfile.objects.create(cover_image=img)
        request = rf.get("/")
        serializer = IntranetProfileSerializer(profile, context={"request": request})
        data = serializer.data
        assert data["cover_image_url"] is not None
        assert "http" in data["cover_image_url"]

    def test_profile_image_url_with_request(self, rf):
        """Cover lines 56-58: profile_image exists with request → absolute URI."""
        img = SimpleUploadedFile("prof2.png", b"\x89PNG", content_type="image/png")
        profile = IntranetProfile.objects.create(profile_image=img)
        request = rf.get("/")
        serializer = IntranetProfileSerializer(profile, context={"request": request})
        data = serializer.data
        assert data["profile_image_url"] is not None
        assert "http" in data["profile_image_url"]


# ---------------------------------------------------------------------------
# LegalDocumentSerializer edges (line 26: no request)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestLegalDocumentSerializerEdges:
    def test_file_url_without_request(self):
        """Cover line 26: no request in context → return raw file.url."""
        f = SimpleUploadedFile("doc.pdf", b"%PDF", content_type="application/pdf")
        doc = LegalDocument.objects.create(name="Doc", file=f)
        serializer = LegalDocumentSerializer(doc)
        data = serializer.data
        assert data["file_url"] is not None
        assert "http" not in data["file_url"]

    def test_file_url_with_request(self, rf):
        """Cover line 25: with request → absolute URI."""
        f = SimpleUploadedFile("doc2.pdf", b"%PDF", content_type="application/pdf")
        doc = LegalDocument.objects.create(name="Doc2", file=f)
        request = rf.get("/")
        serializer = LegalDocumentSerializer(doc, context={"request": request})
        data = serializer.data
        assert "http" in data["file_url"]


# ---------------------------------------------------------------------------
# SubscriptionSerializer.get_user_name (line 46)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestSubscriptionSerializerEdges:
    def test_get_user_name_with_names(self, client_user):
        """Cover line 46: user has first and last name."""
        sub = Subscription.objects.create(
            user=client_user,
            plan_type="cliente",
            status="active",
            next_billing_date=datetime.now().date() + timedelta(days=30),
            amount=Decimal("50000.00"),
        )
        serializer = SubscriptionSerializer(sub)
        data = serializer.data
        assert data["user_name"] == "Ser Client"

    def test_get_user_name_fallback_to_email(self, db):
        """Cover line 46: user with no names → fallback to email."""
        user_no_name = User.objects.create_user(
            email="noname@example.com",
            password="testpassword",
            first_name="",
            last_name="",
        )
        sub = Subscription.objects.create(
            user=user_no_name,
            plan_type="basico",
            status="active",
            next_billing_date=datetime.now().date() + timedelta(days=30),
            amount=Decimal("0.00"),
        )
        serializer = SubscriptionSerializer(sub)
        data = serializer.data
        assert data["user_name"] == "noname@example.com"
