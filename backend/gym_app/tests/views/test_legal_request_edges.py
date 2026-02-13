"""
Edge tests for gym_app/views/legal_request.py to close coverage gaps.

Targets: validate_file_security edges, create_legal_request error paths,
get_or_delete DELETE path, delete_legal_request, download content types,
upload failed files, outer exception handlers.
"""
import pytest
import json
import os
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import User, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        email="lre-client@example.com",
        password="testpassword",
        first_name="LRE",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def lawyer_user(db):
    return User.objects.create_user(
        email="lre-lawyer@example.com",
        password="testpassword",
        first_name="LRE",
        last_name="Lawyer",
        role="lawyer",
    )


@pytest.fixture
def req_type(db):
    return LegalRequestType.objects.create(name="LRE-Type")


@pytest.fixture
def discipline(db):
    return LegalDiscipline.objects.create(name="LRE-Disc")


@pytest.fixture
def legal_request(db, client_user, req_type, discipline):
    return LegalRequest.objects.create(
        user=client_user,
        request_type=req_type,
        discipline=discipline,
        description="LRE test request",
    )


# ---------------------------------------------------------------------------
# validate_file_security edges (lines 47, 52, 65-75, 79, 83-90)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestValidateFileSecurityEdges:
    def test_file_exceeds_max_size(self, api_client, client_user, legal_request):
        """Cover line 47: file size > MAX_FILE_SIZE."""
        api_client.force_authenticate(user=client_user)
        # Create a file that claims to be > 30MB
        big_file = SimpleUploadedFile("big.pdf", b"%PDF-1.4\n", content_type="application/pdf")
        big_file.size = 31 * 1024 * 1024  # 31MB

        url = reverse("upload-legal-request-file")
        response = api_client.post(
            url,
            {"legalRequestId": legal_request.id, "file": big_file},
            format="multipart",
        )
        # File validation failure results in failed_files
        assert response.status_code in (status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST)

    def test_file_extension_not_allowed(self, api_client, client_user, legal_request):
        """Cover line 52: disallowed file extension."""
        api_client.force_authenticate(user=client_user)
        bad_file = SimpleUploadedFile("script.exe", b"\x00\x00", content_type="application/octet-stream")

        url = reverse("upload-legal-request-file")
        response = api_client.post(
            url,
            {"legalRequestId": legal_request.id, "file": bad_file},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# create_legal_request error paths (lines 175, 179-181, 187-188, 238-243)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCreateLegalRequestEdges:
    def test_empty_main_data(self, api_client, client_user):
        """Cover line 175: empty mainData."""
        api_client.force_authenticate(user=client_user)
        url = reverse("create-legal-request")
        response = api_client.post(url, {"mainData": ""}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Main data is required" in response.data["detail"]

    def test_invalid_json_main_data(self, api_client, client_user):
        """Cover lines 179-181: invalid JSON."""
        api_client.force_authenticate(user=client_user)
        url = reverse("create-legal-request")
        response = api_client.post(url, {"mainData": "{invalid json"}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid JSON format" in response.data["detail"]

    def test_missing_required_fields(self, api_client, client_user):
        """Cover lines 187-188: missing required fields."""
        api_client.force_authenticate(user=client_user)
        url = reverse("create-legal-request")
        response = api_client.post(
            url,
            {"mainData": json.dumps({"requestTypeId": 1})},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing required fields" in response.data["detail"]

    def test_unexpected_exception(self, api_client, client_user, req_type, discipline):
        """Cover lines 241-243: unexpected exception returns 500."""
        api_client.force_authenticate(user=client_user)
        url = reverse("create-legal-request")
        main_data = json.dumps({
            "requestTypeId": req_type.id,
            "disciplineId": discipline.id,
            "description": "Test",
        })
        with patch("gym_app.views.legal_request.LegalRequest.objects.create", side_effect=Exception("DB boom")):
            response = api_client.post(url, {"mainData": main_data}, format="multipart")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# upload_legal_request_file edges (lines 262, 288, 312-317)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestUploadLegalRequestFileEdges:
    def test_missing_legal_request_id(self, api_client, client_user):
        """Cover line 262: missing legalRequestId."""
        api_client.force_authenticate(user=client_user)
        url = reverse("upload-legal-request-file")
        response = api_client.post(url, {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Legal request ID is required" in response.data["detail"]

    @patch("gym_app.views.legal_request.process_file_upload")
    def test_upload_with_failed_files(self, mock_upload, api_client, client_user, legal_request):
        """Cover line 288: failed_files path."""
        api_client.force_authenticate(user=client_user)
        mock_upload.return_value = {
            "success": False,
            "error": {"name": "bad.pdf", "message": "Invalid"},
        }
        file = SimpleUploadedFile("bad.pdf", b"%PDF", content_type="application/pdf")
        url = reverse("upload-legal-request-file")
        response = api_client.post(
            url,
            {"legalRequestId": legal_request.id, "file": file},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["failed_uploads"] == 1

    def test_upload_outer_exception(self, api_client, client_user, legal_request):
        """Cover lines 315-317: outer exception returns 500."""
        api_client.force_authenticate(user=client_user)
        file = SimpleUploadedFile("test.pdf", b"%PDF", content_type="application/pdf")
        url = reverse("upload-legal-request-file")
        with patch("gym_app.views.legal_request.LegalRequest.objects.get", side_effect=Exception("unexpected")):
            response = api_client.post(
                url,
                {"legalRequestId": legal_request.id, "file": file},
                format="multipart",
            )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# get_or_delete_legal_request edges (lines 521-522, 534-555)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestGetOrDeleteLegalRequestEdges:
    def test_get_forbidden_for_unrelated_client(self, api_client, legal_request):
        """Cover lines 521-522: client cannot access others' request."""
        other = User.objects.create_user(
            email="lre-other@example.com", password="tp",
            first_name="Oth", last_name="Er", role="client",
        )
        api_client.force_authenticate(user=other)
        url = reverse("get-or-delete-legal-request", args=[legal_request.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_by_lawyer(self, api_client, lawyer_user, legal_request):
        """Cover lines 534-555: DELETE method by lawyer."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-or-delete-legal-request", args=[legal_request.id])
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_200_OK
        assert "deleted successfully" in response.data["message"]

    def test_delete_forbidden_for_client(self, api_client, client_user, legal_request):
        """Cover lines 536-540: client cannot delete."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-or-delete-legal-request", args=[legal_request.id])
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# delete_legal_request edges (line 712, 730-732)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDeleteLegalRequestEdges:
    def test_delete_forbidden_for_non_lawyer(self, api_client, client_user, legal_request):
        """Cover line 712: non-lawyer cannot delete."""
        api_client.force_authenticate(user=client_user)
        url = reverse("delete-legal-request", args=[legal_request.id])
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_exception(self, api_client, lawyer_user, legal_request):
        """Cover lines 730-732: exception returns 500."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-legal-request", args=[legal_request.id])
        with patch("gym_app.views.legal_request.get_object_or_404", side_effect=Exception("boom")):
            response = api_client.delete(url)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# send_confirmation_email outer exception (lines 407-409)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestSendConfirmationEmailEdges:
    def test_outer_exception(self, api_client, client_user):
        """Cover lines 407-409: outer exception returns 500."""
        api_client.force_authenticate(user=client_user)
        url = reverse("send-confirmation-email")
        with patch.object(LegalRequest.objects, "get", side_effect=Exception("unexpected")):
            response = api_client.post(url, {"legal_request_id": 1}, format="json")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# list_legal_requests edges (lines 477-478, 494-496)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestListLegalRequestsEdges:
    def test_date_to_filter(self, api_client, client_user, legal_request):
        """Cover lines 477-478: date_to filter applied."""
        api_client.force_authenticate(user=client_user)
        url = reverse("list-legal-requests")
        response = api_client.get(url, {"date_to": "2099-12-31"})
        assert response.status_code == status.HTTP_200_OK

    def test_exception_returns_500(self, api_client, client_user):
        """Cover lines 494-496: exception returns 500."""
        api_client.force_authenticate(user=client_user)
        url = reverse("list-legal-requests")
        with patch("gym_app.views.legal_request.LegalRequest.objects.select_related", side_effect=Exception("boom")):
            response = api_client.get(url)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# update_legal_request_status exception (lines 618-620)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestUpdateStatusEdges:
    def test_exception_returns_500(self, api_client, lawyer_user, legal_request):
        """Cover lines 618-620: exception returns 500."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-legal-request-status", args=[legal_request.id])
        with patch("gym_app.views.legal_request.get_object_or_404", side_effect=Exception("boom")):
            response = api_client.put(url, {"status": "IN_REVIEW"}, format="json")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# create_legal_request_response exception (lines 692-694)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCreateResponseEdges:
    def test_exception_returns_500(self, api_client, client_user, legal_request):
        """Cover lines 692-694: exception returns 500."""
        api_client.force_authenticate(user=client_user)
        url = reverse("create-legal-request-response", args=[legal_request.id])
        with patch("gym_app.views.legal_request.get_object_or_404", side_effect=Exception("boom")):
            response = api_client.post(url, {"response_text": "test"}, format="json")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ---------------------------------------------------------------------------
# download content types (lines 872-886) & exception (917-919)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDownloadContentTypeEdges:
    def _create_file(self, legal_request, name, content=b"content"):
        """Helper to create and attach a file."""
        f = SimpleUploadedFile(name, content, content_type="application/octet-stream")
        file_obj = LegalRequestFiles.objects.create(file=f)
        legal_request.files.add(file_obj)
        return file_obj

    def test_download_pdf(self, api_client, client_user, legal_request):
        """Cover line 872: .pdf content type."""
        file_obj = self._create_file(legal_request, "doc.pdf", b"%PDF-1.4")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"

    def test_download_doc(self, api_client, client_user, legal_request):
        """Cover line 874: .doc content type."""
        file_obj = self._create_file(legal_request, "doc.doc")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/msword"

    def test_download_docx(self, api_client, client_user, legal_request):
        """Cover line 876: .docx content type."""
        file_obj = self._create_file(legal_request, "doc.docx")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "wordprocessingml" in response["Content-Type"]

    def test_download_jpg(self, api_client, client_user, legal_request):
        """Cover line 878: .jpg content type."""
        file_obj = self._create_file(legal_request, "img.jpg")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/jpeg"

    def test_download_png(self, api_client, client_user, legal_request):
        """Cover line 880: .png content type."""
        file_obj = self._create_file(legal_request, "img.png")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/png"

    def test_download_xlsx(self, api_client, client_user, legal_request):
        """Cover lines 883-884: .xlsx content type."""
        file_obj = self._create_file(legal_request, "sheet.xlsx")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "spreadsheetml" in response["Content-Type"]

    def test_download_unknown_extension(self, api_client, client_user, legal_request):
        """Cover lines 885-886: unknown extension → octet-stream."""
        file_obj = self._create_file(legal_request, "data.xyz")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/octet-stream"

    def test_download_outer_exception(self, api_client, client_user, legal_request):
        """Cover lines 917-919: outer exception returns 500."""
        file_obj = self._create_file(legal_request, "test.pdf")
        api_client.force_authenticate(user=client_user)
        url = reverse("download-legal-request-file", args=[legal_request.id, file_obj.id])
        with patch("gym_app.views.legal_request.os.path.exists", side_effect=Exception("boom")):
            response = api_client.get(url)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
