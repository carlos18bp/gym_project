import pytest
import os
from datetime import timedelta
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from gym_app.models.legal_request import (
    LegalRequestType,
    LegalDiscipline,
    LegalRequestFiles,
    LegalRequest,
    LegalRequestResponse,
)
from gym_app.models import User

@pytest.fixture
def legal_request_type():
    """Create a legal request type for testing"""
    return LegalRequestType.objects.create(name="Consultation")

@pytest.fixture
def legal_discipline():
    """Create a legal discipline for testing"""
    return LegalDiscipline.objects.create(name="Corporate Law")


@pytest.fixture
def user():
    """Create a user associated with legal requests for testing"""
    return User.objects.create_user(
        email="john.doe@example.com",
        password="password123",
        first_name="John",
        last_name="Doe",
    )

@pytest.fixture
def legal_request_file():
    """Create a legal request file for testing"""
    test_file = SimpleUploadedFile(
        "test_document.pdf",
        b"File content for testing",
        content_type="application/pdf"
    )
    return LegalRequestFiles.objects.create(file=test_file)

@pytest.fixture
def legal_request(legal_request_type, legal_discipline, user):
    """Create a legal request for testing"""
    return LegalRequest.objects.create(
        user=user,
        request_type=legal_request_type,
        discipline=legal_discipline,
        description="I need legal advice for my company formation.",
    )

@pytest.mark.django_db
class TestLegalRequestType:
    
    def test_create_legal_request_type(self):
        """Test creating a legal request type"""
        request_type = LegalRequestType.objects.create(name="Contract Review")
        
        assert request_type.id is not None
        assert request_type.name == "Contract Review"
    
    def test_unique_name_constraint(self, legal_request_type):
        """Test unique name constraint for legal request types"""
        with pytest.raises(Exception) as exc_info:  # This should raise an exception due to unique constraint
            LegalRequestType.objects.create(name=legal_request_type.name)
        assert exc_info.value is not None
        assert LegalRequestType.objects.filter(name=legal_request_type.name).count() == 1
    
    def test_str_representation(self, legal_request_type):
        """Test string representation of legal request type"""
        assert str(legal_request_type) == legal_request_type.name

@pytest.mark.django_db
class TestLegalDiscipline:
    
    def test_create_legal_discipline(self):
        """Test creating a legal discipline"""
        discipline = LegalDiscipline.objects.create(name="Family Law")
        
        assert discipline.id is not None
        assert discipline.name == "Family Law"
    
    def test_unique_name_constraint(self, legal_discipline):
        """Test unique name constraint for legal disciplines"""
        with pytest.raises(Exception) as exc_info:  # This should raise an exception due to unique constraint
            LegalDiscipline.objects.create(name=legal_discipline.name)
        assert exc_info.value is not None
        assert LegalDiscipline.objects.filter(name=legal_discipline.name).count() == 1
    
    def test_str_representation(self, legal_discipline):
        """Test string representation of legal discipline"""
        assert str(legal_discipline) == legal_discipline.name

@pytest.mark.django_db
class TestLegalRequestFiles:
    
    def test_create_legal_request_file(self):
        """Test creating a legal request file"""
        test_file = SimpleUploadedFile(
            "new_document.pdf",
            b"New file content",
            content_type="application/pdf"
        )
        
        file_obj = LegalRequestFiles.objects.create(file=test_file)
        
        assert file_obj.id is not None
        assert "new_document" in file_obj.file.name
        assert file_obj.created_at is not None
    
    def test_str_representation(self, legal_request_file):
        """Test string representation of legal request file"""
        file_name = os.path.basename(legal_request_file.file.name)
        assert str(legal_request_file) == file_name

@pytest.mark.django_db
class TestLegalRequest:

    def test_create_legal_request(self, legal_request_type, legal_discipline, user):
        """Test creating a legal request"""
        request = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description="I need advice on intellectual property.",
        )

        assert request.id is not None
        assert request.user == user
        assert request.request_type == legal_request_type
        assert request.discipline == legal_discipline
        assert request.description == "I need advice on intellectual property."
        assert request.created_at is not None
        # No files added yet
        assert request.files.count() == 0
    
    def test_add_files_to_legal_request(self, legal_request, legal_request_file):
        """Test adding files to a legal request"""
        # Add the existing file
        legal_request.files.add(legal_request_file)
        
        # Create and add a new file
        new_file = SimpleUploadedFile(
            "additional_document.pdf",
            b"Additional file content",
            content_type="application/pdf"
        )
        new_file_obj = LegalRequestFiles.objects.create(file=new_file)
        legal_request.files.add(new_file_obj)
        
        # Refresh the object from DB
        legal_request.refresh_from_db()
        
        # Verify files were added
        assert legal_request.files.count() == 2
        file_names = [os.path.basename(f.file.name) for f in legal_request.files.all()]
        assert any("test_document" in name for name in file_names)
        assert any("additional_document" in name for name in file_names)
    
    def test_remove_file_from_legal_request(self, legal_request, legal_request_file):
        """Test removing a file from a legal request"""
        # First add the file
        legal_request.files.add(legal_request_file)
        assert legal_request.files.count() == 1
        
        # Now remove the file from the relationship (but not delete the file object)
        legal_request.files.remove(legal_request_file)
        
        # Verify file was removed
        assert legal_request.files.count() == 0
        
        # Verify file object still exists
        assert LegalRequestFiles.objects.filter(id=legal_request_file.id).exists()
    
    def test_str_representation(self, legal_request):
        """Test string representation of legal request"""
        expected = f"{legal_request.request_number} - {legal_request.user.first_name} {legal_request.user.last_name}"
        assert str(legal_request) == expected


@pytest.mark.django_db
class TestLegalRequestResponse:
    def test_response_ordering_by_created_at(self, legal_request, user):
        older = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Primera",
            user=user,
            user_type="client",
        )
        newer = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Segunda",
            user=user,
            user_type="client",
        )

        older_time = timezone.now() - timedelta(days=1)
        newer_time = timezone.now()
        LegalRequestResponse.objects.filter(pk=older.pk).update(created_at=older_time)
        LegalRequestResponse.objects.filter(pk=newer.pk).update(created_at=newer_time)

        responses = list(LegalRequestResponse.objects.all())

        assert responses[0].id == older.id
        assert responses[1].id == newer.id


# ======================================================================
# Tests moved from test_model_consolidated.py
# ======================================================================

# ── LegalRequest ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLegalRequestEdges:
    def test_request_number_auto_generated(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld,
            description="Desc",
        )
        year = timezone.now().year
        assert lr.request_number.startswith(f"SOL-{year}-")

    def test_request_number_increments(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr1 = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D1",
        )
        lr2 = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D2",
        )
        seq1 = int(lr1.request_number.split("-")[-1])
        seq2 = int(lr2.request_number.split("-")[-1])
        assert seq2 == seq1 + 1

    def test_legal_request_str_with_user(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D",
        )
        s = str(lr)
        assert lr.request_number in s
        assert client_user.first_name in s

    def test_legal_request_response_str(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D",
        )
        resp = LegalRequestResponse.objects.create(
            legal_request=lr, response_text="R", user=client_user, user_type="client",
        )
        s = str(resp)
        assert lr.request_number in s
        assert "client response" in s

    def test_legal_request_files_str(self):
        f = SimpleUploadedFile("legal.pdf", b"x", content_type="application/pdf")
        lrf = LegalRequestFiles.objects.create(file=f)
        assert "legal" in str(lrf)

    def test_legal_request_files_delete_signal(self):
        f = SimpleUploadedFile("del.pdf", b"x", content_type="application/pdf")
        lrf = LegalRequestFiles.objects.create(file=f)
        path = lrf.file.path
        assert os.path.isfile(path)
        lrf.delete()
        assert not os.path.isfile(path)


# ── Organization ─────────────────────────────────────────────────────────────


# ---------------------------------------------------------------------------
# legal_request.py – line 121: __str__ when self.user is None
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLegalRequestStrWithoutUser:
    def test_str_returns_request_number_only_when_user_is_none(self):
        """
        LegalRequest.__str__() should return just the request_number
        when the user field is None (line 121).

        The user FK is NOT NULL at DB level, so we temporarily replace
        the FK descriptor with None to simulate the branch.
        """
        req_type = LegalRequestType.objects.create(name="Cov100 Type")
        discipline = LegalDiscipline.objects.create(name="Cov100 Disc")
        temp_user = User.objects.create_user(
            email="temp_lr_cov100@test.com", password="pw"
        )
        lr = LegalRequest.objects.create(
            user=temp_user,
            request_type=req_type,
            discipline=discipline,
            description="Test",
        )

        # Temporarily replace the FK descriptor so self.user returns None
        with patch.object(LegalRequest, "user", new=None):
            result = str(lr)

        assert result == lr.request_number


# ---------------------------------------------------------------------------
# organization.py – line 214: accept() on non-respondable invitation
# ---------------------------------------------------------------------------


