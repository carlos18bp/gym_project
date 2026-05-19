"""Coverage-gap tests for gym_app.views.service_tramite.

Covers inbox filtering, document download, admin 403 branches, save/submit
error paths, private helpers, and select-list/file-field edge cases.
"""

import json
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import (
    Service,
    ServiceField,
    ServiceRequest,
    ServiceStage,
)
from gym_app.services.service_tramite_pdf import ServiceRequestPDFError

User = get_user_model()


# ------------------------------------------------------------------
# Local fixtures
# ------------------------------------------------------------------


@pytest.fixture
def admin_user():
    """Create an admin/staff user for gaps views tests."""
    return User.objects.create_user(
        email="admin_gaps@test.com",
        password="testpassword",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def second_client_user():
    """Create a second client user for gaps views tests."""
    return User.objects.create_user(
        email="client2_gaps@test.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def sample_service():
    """Create a sample active Service with one stage for gaps views tests."""
    service = Service.objects.create(
        name="Servicio Gap",
        short_title="Gap",
        slug="servicio-gap",
        is_active=True,
    )
    stage = ServiceStage.objects.create(service=service, title="S1", order=1, is_active=True)
    ServiceField.objects.create(stage=stage, key="nombre", label="Nombre", field_type="input", is_required=True, order=1)
    return service


@pytest.fixture
def other_service():
    """Create a second active Service for cross-service filter tests."""
    service = Service.objects.create(
        name="Otro Servicio",
        short_title="Otro",
        slug="otro-gap",
        is_active=True,
    )
    ServiceStage.objects.create(service=service, title="Stg", order=1, is_active=True)
    return service


def _submitted_request(service, requester, status="OPEN"):
    req = ServiceRequest.objects.create(
        service=service, requester=requester, status=status, is_submitted=True,
    )
    req.assign_tracking_number()
    req.save()
    return req


@pytest.fixture
def submitted_for_lawyer(sample_service, client_user):
    """Create a submitted ServiceRequest for lawyer inbox tests."""
    return _submitted_request(sample_service, client_user)


@pytest.fixture
def request_with_pdf(sample_service, client_user, settings, tmp_path):
    """Create a submitted ServiceRequest with a generated PDF document on disk."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = _submitted_request(sample_service, client_user)
    req.generated_document.save("doc.pdf", ContentFile(b"%PDF-1.4 body"), save=False)
    req.save()
    return req


# ------------------------------------------------------------------
# list_service_requests_inbox
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_inbox_returns_all_submitted_requests_for_lawyer(
    api_client, lawyer_user, submitted_for_lawyer
):
    """Return all submitted requests in the lawyer inbox list."""
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.get(reverse("service-request-inbox-list"))

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert submitted_for_lawyer.id in ids


@pytest.mark.django_db
def test_inbox_filters_by_status(api_client, lawyer_user, sample_service, client_user):
    """Filter inbox results by request status."""
    _submitted_request(sample_service, client_user, status="OPEN")
    _submitted_request(sample_service, client_user, status="IN_STUDY")

    api_client.force_authenticate(user=lawyer_user)
    response = api_client.get(reverse("service-request-inbox-list"), {"status": "OPEN"})

    assert response.status_code == 200
    assert {r["status"] for r in response.data["results"]} == {"OPEN"}


@pytest.mark.django_db
def test_inbox_filters_by_service(api_client, lawyer_user, sample_service, other_service, client_user):
    """Filter inbox results by service ID."""
    req_a = _submitted_request(sample_service, client_user)
    req_b = _submitted_request(other_service, client_user)

    api_client.force_authenticate(user=lawyer_user)
    response = api_client.get(
        reverse("service-request-inbox-list"), {"service": sample_service.id}
    )

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert req_a.id in ids
    assert req_b.id not in ids


@pytest.mark.django_db
def test_inbox_filters_by_tracking_number(api_client, lawyer_user, submitted_for_lawyer):
    """Filter inbox results by partial tracking number."""
    api_client.force_authenticate(user=lawyer_user)
    partial = submitted_for_lawyer.tracking_number[-3:]

    response = api_client.get(reverse("service-request-inbox-list"), {"tracking": partial})

    assert response.status_code == 200
    assert submitted_for_lawyer.tracking_number in {
        r["tracking_number"] for r in response.data["results"]
    }


@pytest.mark.django_db
def test_inbox_search_matches_requester_email(
    api_client, lawyer_user, submitted_for_lawyer, client_user
):
    """Match inbox results by partial requester email in search query."""
    api_client.force_authenticate(user=lawyer_user)
    fragment = client_user.email.split("@")[0]

    response = api_client.get(reverse("service-request-inbox-list"), {"search": fragment})

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert submitted_for_lawyer.id in ids


@freeze_time("2026-04-15 12:00:00")
@pytest.mark.django_db
def test_inbox_date_from_excludes_older_requests(
    api_client, lawyer_user, sample_service, client_user, submitted_for_lawyer
):
    """Exclude requests older than date_from from inbox results."""
    old = _submitted_request(sample_service, client_user)
    ServiceRequest.objects.filter(id=old.id).update(
        created_at=timezone.now() - timedelta(days=30)
    )

    api_client.force_authenticate(user=lawyer_user)
    yesterday = (timezone.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    response = api_client.get(reverse("service-request-inbox-list"), {"date_from": yesterday})

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert old.id not in ids


@freeze_time("2026-04-15 12:00:00")
@pytest.mark.django_db
def test_inbox_date_to_excludes_newer_requests(
    api_client, lawyer_user, sample_service, client_user, submitted_for_lawyer
):
    """Exclude requests newer than date_to from inbox results."""
    old = _submitted_request(sample_service, client_user)
    ServiceRequest.objects.filter(id=old.id).update(
        created_at=timezone.now() - timedelta(days=30)
    )

    api_client.force_authenticate(user=lawyer_user)
    yesterday = (timezone.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    response = api_client.get(reverse("service-request-inbox-list"), {"date_to": yesterday})

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert submitted_for_lawyer.id not in ids
    assert old.id in ids


@pytest.mark.django_db
def test_inbox_ignores_invalid_date_format(api_client, lawyer_user, submitted_for_lawyer):
    """Ignore invalid date format parameters and return all requests."""
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.get(
        reverse("service-request-inbox-list"),
        {"date_from": "not-a-date", "date_to": "also-bad"},
    )

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert submitted_for_lawyer.id in ids


# ------------------------------------------------------------------
# download_service_request_document
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_owner_can_download_generated_document(api_client, client_user, request_with_pdf):
    """Allow the request owner to download the generated document."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("service-request-document-download", kwargs={"request_id": request_with_pdf.id})
    )

    assert response.status_code == 200
    assert "attachment" in response.get("Content-Disposition", "")


@pytest.mark.django_db
def test_download_document_returns_404_when_no_document(
    api_client, client_user, submitted_for_lawyer
):
    """Return 404 when the service request has no generated document."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("service-request-document-download", kwargs={"request_id": submitted_for_lawyer.id})
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_download_document_returns_403_for_other_user(
    api_client, second_client_user, request_with_pdf
):
    """Return 403 when a non-owner user attempts to download the document."""
    api_client.force_authenticate(user=second_client_user)

    response = api_client.get(
        reverse("service-request-document-download", kwargs={"request_id": request_with_pdf.id})
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_download_document_returns_404_when_file_missing_on_disk(
    api_client, client_user, request_with_pdf
):
    """Return 404 when the generated document file is missing from disk."""
    import os
    os.unlink(request_with_pdf.generated_document.path)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(
        reverse("service-request-document-download", kwargs={"request_id": request_with_pdf.id})
    )

    assert response.status_code == 404


# ------------------------------------------------------------------
# Admin 403 branches (non-admin attempts)
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_non_admin_cannot_list_admin_services(api_client, client_user):
    """Return 403 when a non-admin user requests the admin service list."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("services-admin-list"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_non_admin_cannot_update_service(api_client, client_user, sample_service):
    """Return 403 when a non-admin user attempts to update a service."""
    api_client.force_authenticate(user=client_user)
    response = api_client.put(
        reverse("services-admin-update", kwargs={"service_id": sample_service.id}),
        {"payload": json.dumps({"name": "Nuevo", "slug": sample_service.slug})},
        format="multipart",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_non_admin_cannot_toggle_active(api_client, client_user, sample_service):
    """Return 403 when a non-admin user attempts to toggle service active status."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("services-admin-toggle-active", kwargs={"service_id": sample_service.id})
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_non_admin_cannot_toggle_featured(api_client, client_user, sample_service):
    """Return 403 when a non-admin user attempts to toggle service featured status."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("services-admin-toggle-featured", kwargs={"service_id": sample_service.id})
    )
    assert response.status_code == 403


# ------------------------------------------------------------------
# save_or_submit_service_request — error paths
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_save_rejects_invalid_json_payload(api_client, client_user):
    """Return 400 when the payload field is not valid JSON."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": "not-valid-json{"},
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_save_rejects_missing_service_id(api_client, client_user):
    """Return 400 with a service_id error when service_id is absent from the payload."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({"answers": [], "current_stage": 1, "is_submit": False})},
        format="multipart",
    )

    assert response.status_code == 400
    assert "service_id" in str(response.data["detail"])


@pytest.mark.django_db
def test_save_rejects_inactive_service_for_non_manager(api_client, client_user):
    """Return 400 when a non-manager user tries to submit to an inactive service."""
    inactive = Service.objects.create(
        name="Inactivo", short_title="I", slug="inactivo-save", is_active=False
    )
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({"service_id": inactive.id, "answers": [], "is_submit": False})},
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_save_rejects_other_users_request_for_non_manager(
    api_client, second_client_user, submitted_for_lawyer
):
    """Return 403 when a non-manager user attempts to modify another user's request."""
    api_client.force_authenticate(user=second_client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": submitted_for_lawyer.service_id,
            "request_id": submitted_for_lawyer.id,
            "answers": [],
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_save_with_invalid_current_stage_is_silently_ignored(
    api_client, client_user, sample_service
):
    """Silently ignore a non-integer current_stage value and save successfully."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": sample_service.id,
            "current_stage": "not-an-int",
            "answers": [],
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["is_submitted"] is False


@pytest.mark.django_db
def test_submit_returns_500_when_pdf_generation_fails(
    api_client, client_user, sample_service, monkeypatch
):
    """Return 500 when PDF generation raises ServiceRequestPDFError during submission."""
    fields = {f.key: f for f in sample_service.stages.first().fields.all()}

    def raise_pdf(_):
        raise ServiceRequestPDFError("pdf failed")

    monkeypatch.setattr("gym_app.views.service_tramite.generate_service_request_pdf", raise_pdf)
    monkeypatch.setattr(
        "gym_app.views.service_tramite.notify_service_request_submission", lambda *_: None
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": sample_service.id,
            "answers": [{"field_id": fields["nombre"].id, "value_text": "Ana"}],
            "is_submit": True,
        })},
        format="multipart",
    )

    assert response.status_code == 500


# ------------------------------------------------------------------
# list_my_service_requests — service filter + invalid date_to
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_my_requests_filters_by_service_id(
    api_client, client_user, sample_service, other_service
):
    """Filter my-requests list by service ID."""
    req_a = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="OPEN", is_submitted=True
    )
    req_a.assign_tracking_number(); req_a.save()
    req_b = ServiceRequest.objects.create(
        service=other_service, requester=client_user, status="OPEN", is_submitted=True
    )
    req_b.assign_tracking_number(); req_b.save()

    api_client.force_authenticate(user=client_user)
    response = api_client.get(
        reverse("service-request-my-list"), {"service": sample_service.id}
    )

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert req_a.id in ids
    assert req_b.id not in ids


@pytest.mark.django_db
def test_my_requests_ignores_invalid_date_to(api_client, client_user, submitted_for_lawyer):
    """Ignore invalid date_to value and return all requests in my-requests list."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("service-request-my-list"), {"date_to": "not-a-date"}
    )

    assert response.status_code == 200
    ids = {r["id"] for r in response.data["results"]}
    assert submitted_for_lawyer.id in ids


# ------------------------------------------------------------------
# _to_bool "on" alias
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_list_services_include_inactive_on_alias_for_manager(
    api_client, lawyer_user, sample_service
):
    """Treat 'on' as a truthy alias for include_inactive parameter for manager users."""
    Service.objects.create(name="Inactivo", short_title="I", slug="inactivo-on", is_active=False)
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.get(reverse("services-list"), {"include_inactive": "on"})

    assert response.status_code == 200
    slugs = {s["slug"] for s in response.data["services"]}
    assert "inactivo-on" in slugs


# ------------------------------------------------------------------
# admin_update_service — icon_image update
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_update_replaces_icon_image(api_client, admin_user, sample_service):
    """Replace the service icon image when admin submits a new PNG via admin_update."""
    api_client.force_authenticate(user=admin_user)
    stage = sample_service.stages.first()
    field = stage.fields.first()
    # PIL-encoded PNG: Django's ImageField validator parses the bytes, so raw
    # PNG signatures won't pass.
    from io import BytesIO

    from PIL import Image
    buf = BytesIO()
    Image.new("RGB", (1, 1), color=(255, 0, 0)).save(buf, format="PNG")
    new_icon = SimpleUploadedFile("icon.png", buf.getvalue(), content_type="image/png")
    payload = {
        "name": "Servicio Actualizado Gap",
        "short_title": "GapUpd",
        "slug": sample_service.slug,
        "description": "Con icono",
        "is_active": True,
        "is_featured": True,
        "featured_order": 1,
        "stages": [
            {
                "id": stage.id,
                "title": stage.title,
                "order": 1,
                "is_active": True,
                "fields": [
                    {
                        "id": field.id,
                        "key": field.key,
                        "label": field.label,
                        "field_type": "input",
                        "is_required": True,
                        "order": 1,
                    }
                ],
            }
        ],
    }

    response = api_client.put(
        reverse("services-admin-update", kwargs={"service_id": sample_service.id}),
        {"payload": json.dumps(payload), "icon_image": new_icon},
        format="multipart",
    )

    assert response.status_code == 200, response.data
    sample_service.refresh_from_db()
    assert sample_service.icon_image.name.endswith(".png")


# ------------------------------------------------------------------
# Pure-helper unit tests (exercise private functions directly)
# ------------------------------------------------------------------


def test_parse_json_payload_raises_for_non_dict_after_parse():
    """Raise ValidationError when the parsed JSON payload is not a dict."""
    from rest_framework.exceptions import ValidationError

    from gym_app.views.service_tramite import _parse_json_payload

    class _Req:
        data = {"payload": json.dumps([1, 2, 3])}

    with pytest.raises(ValidationError) as exc_info:
        _parse_json_payload(_Req())
    assert exc_info.type is ValidationError


def test_parse_json_payload_raises_on_invalid_json_string(rf):
    """Raise ValidationError when the payload string is not valid JSON."""
    from rest_framework.exceptions import ValidationError

    from gym_app.views.service_tramite import _parse_json_payload

    class _Req:
        data = {"payload": "{not-json"}

    with pytest.raises(ValidationError) as exc_info:
        _parse_json_payload(_Req())
    assert exc_info.type is ValidationError


def test_parse_json_payload_accepts_querydict_like():
    """Accept a QueryDict-like object and return its items as a plain dict."""
    from django.http import QueryDict

    from gym_app.views.service_tramite import _parse_json_payload

    qd = QueryDict("", mutable=True)
    qd.update({"service_id": "5", "name": "Foo"})

    class _Req:
        data = qd

    out = _parse_json_payload(_Req())
    assert out == {"service_id": "5", "name": "Foo"}


def test_to_bool_handles_truthy_and_falsy_variants():
    """Convert truthy/falsy string variants and Python booleans via _to_bool."""
    from gym_app.views.service_tramite import _to_bool

    assert _to_bool(True) is True
    assert _to_bool(False) is False
    assert _to_bool(None) is False
    assert _to_bool("on") is True
    assert _to_bool("si") is True
    assert _to_bool("no") is False
    assert _to_bool(" YES ") is True


def test_uploaded_files_ignores_non_matching_keys(rf):
    """Group uploaded files by integer field ID and ignore non-matching request keys."""
    from gym_app.views.service_tramite import _uploaded_files_by_field

    file_a = SimpleUploadedFile("a.pdf", b"A", content_type="application/pdf")
    file_b = SimpleUploadedFile("b.pdf", b"B", content_type="application/pdf")
    file_c = SimpleUploadedFile("c.pdf", b"C", content_type="application/pdf")

    request = rf.post(
        "/",
        {
            "field_files_7": file_a,
            "other_upload": file_b,
            "field_files_not_int": file_c,
        },
        format="multipart",
    )

    result = _uploaded_files_by_field(request)
    assert 7 in result
    assert len(result[7]) == 1
    assert "not_int" not in result
    assert all(isinstance(k, int) for k in result.keys())


def test_normalize_extensions_returns_default_for_empty_list():
    """Return DEFAULT_ALLOWED_EXTENSIONS when the extensions list is empty or None."""
    from gym_app.views.service_tramite import (
        DEFAULT_ALLOWED_EXTENSIONS,
        _normalize_extensions,
    )

    assert _normalize_extensions([]) == DEFAULT_ALLOWED_EXTENSIONS
    assert _normalize_extensions(None) == DEFAULT_ALLOWED_EXTENSIONS


def test_normalize_extensions_prefixes_dot_and_skips_blanks():
    """Add dot prefix to extension strings and skip blank entries."""
    from gym_app.views.service_tramite import _normalize_extensions

    assert _normalize_extensions(["jpg", "  ", ".png", "PDF"]) == {".jpg", ".png", ".pdf"}


def test_normalize_extensions_falls_back_to_default_when_only_blanks():
    """Return DEFAULT_ALLOWED_EXTENSIONS when all extension entries are blank strings."""
    from gym_app.views.service_tramite import (
        DEFAULT_ALLOWED_EXTENSIONS,
        _normalize_extensions,
    )

    assert _normalize_extensions(["  ", ""]) == DEFAULT_ALLOWED_EXTENSIONS


@pytest.mark.django_db
def test_validate_field_file_rejects_oversized_upload(sample_service, monkeypatch):
    """Raise ValidationError when the uploaded file exceeds MAX_UPLOAD_SIZE."""
    from django.core.exceptions import ValidationError

    from gym_app.views import service_tramite as tramite_module
    from gym_app.views.service_tramite import _validate_field_file

    # Shrink the limit so we don't need to allocate a 30MB payload to hit the guard.
    monkeypatch.setattr(tramite_module, "MAX_UPLOAD_SIZE", 8)
    oversized = SimpleUploadedFile("big.pdf", b"x" * 16, content_type="application/pdf")
    field = sample_service.stages.first().fields.first()

    with pytest.raises(ValidationError) as exc_info:
        _validate_field_file(oversized, field)
    assert exc_info.type is ValidationError


# ------------------------------------------------------------------
# save/submit behavioural coverage — remaining view branches
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_save_accepts_answers_as_dict_shape(api_client, client_user, sample_service):
    """Accept answers payload as a dict keyed by field ID instead of a list."""
    api_client.force_authenticate(user=client_user)
    field = sample_service.stages.first().fields.first()

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": sample_service.id,
            "answers": {str(field.id): {"field_id": field.id, "value_text": "Ana"}},
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["is_submitted"] is False


@pytest.mark.django_db
def test_save_ignores_non_dict_answer_items(api_client, client_user, sample_service):
    """Silently ignore non-dict answer items in the answers list."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": sample_service.id,
            "answers": ["not-a-dict", 42, None],
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_save_ignores_answer_with_invalid_field_id(api_client, client_user, sample_service):
    """Silently skip answer items with non-integer field_id values."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": sample_service.id,
            "answers": [{"field_id": "not-an-int", "value_text": "X"}],
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_save_uses_generic_value_key_as_text_fallback(
    api_client, client_user, sample_service, monkeypatch
):
    """Use the generic 'value' key as value_text when no specific key is provided."""
    api_client.force_authenticate(user=client_user)
    field = sample_service.stages.first().fields.first()

    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": sample_service.id,
            "answers": [{"field_id": field.id, "value": "Via generic key"}],
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 200
    saved_answer = ServiceRequest.objects.get(id=response.data["id"]).answers.get(field_key=field.key)
    assert saved_answer.value_text == "Via generic key"


@pytest.mark.django_db
def test_save_uses_generic_value_key_as_list_fallback(api_client, client_user):
    """Use the generic 'value' key as value_json when the value is a list."""
    service = Service.objects.create(name="Multi", short_title="M", slug="multi-gv", is_active=True)
    stage = ServiceStage.objects.create(service=service, title="S", order=1, is_active=True)
    select_field = ServiceField.objects.create(
        stage=stage, key="opts", label="Opts", field_type="select_multiple",
        options=["A", "B"], is_required=False, order=1,
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("service-request-save"),
        {"payload": json.dumps({
            "service_id": service.id,
            "answers": [{"field_id": select_field.id, "value": ["A", "B"]}],
            "is_submit": False,
        })},
        format="multipart",
    )

    assert response.status_code == 200
    saved = ServiceRequest.objects.get(id=response.data["id"]).answers.get(field_key="opts")
    assert saved.value_json == ["A", "B"]


@pytest.mark.django_db
def test_save_rejects_file_upload_on_non_file_field(api_client, client_user, sample_service):
    """Return 400 when a file is uploaded for a non-file field type."""
    api_client.force_authenticate(user=client_user)
    text_field = sample_service.stages.first().fields.get(key="nombre")

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": sample_service.id,
                "answers": [],
                "is_submit": False,
            }),
            f"field_files_{text_field.id}": SimpleUploadedFile(
                "x.pdf", b"%PDF-1.4", content_type="application/pdf"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_save_ignores_file_upload_for_unknown_field_id(api_client, client_user, sample_service):
    """Silently ignore file uploads for field IDs that do not exist in the service."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": sample_service.id,
                "answers": [],
                "is_submit": False,
            }),
            "field_files_999999": SimpleUploadedFile(
                "x.pdf", b"%PDF-1.4", content_type="application/pdf"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_save_rejects_multi_file_field_exceeding_max_files(api_client, client_user):
    """Return 400 when the number of uploaded files exceeds the field's max_files limit."""
    service = Service.objects.create(
        name="MultiFile", short_title="MF", slug="multifile-svc", is_active=True
    )
    stage = ServiceStage.objects.create(service=service, title="S", order=1, is_active=True)
    multi_field = ServiceField.objects.create(
        stage=stage, key="docs", label="Docs", field_type="file",
        is_required=False, order=1,
        allow_multiple_files=True, max_files=2, allowed_extensions=[".pdf"],
    )

    from django.test.client import BOUNDARY, encode_multipart
    files = [
        SimpleUploadedFile(f"f{i}.pdf", b"%PDF-1.4", content_type="application/pdf")
        for i in range(3)
    ]
    data = encode_multipart(BOUNDARY, {
        "payload": json.dumps({
            "service_id": service.id,
            "answers": [],
            "is_submit": False,
        }),
        f"field_files_{multi_field.id}": files,
    })

    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("service-request-save"),
        data,
        content_type=f"multipart/form-data; boundary={BOUNDARY}",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_save_replaces_existing_file_and_schedules_cleanup(
    api_client, client_user, settings, tmp_path
):
    """Replace an existing field file when a new upload is submitted for the same field."""
    settings.MEDIA_ROOT = str(tmp_path)
    service = Service.objects.create(
        name="Replace", short_title="Rep", slug="replace-svc", is_active=True
    )
    stage = ServiceStage.objects.create(service=service, title="S", order=1, is_active=True)
    file_field = ServiceField.objects.create(
        stage=stage, key="doc", label="Doc", field_type="file",
        is_required=False, order=1,
        allow_multiple_files=False, max_files=1, allowed_extensions=[".pdf"],
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": service.id,
                "answers": [],
                "is_submit": False,
            }),
            f"field_files_{file_field.id}": SimpleUploadedFile(
                "first.pdf", b"%PDF-1.4 first", content_type="application/pdf"
            ),
        },
        format="multipart",
    )
    assert response.status_code == 200
    request_id = response.data["id"]

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": service.id,
                "request_id": request_id,
                "answers": [],
                "is_submit": False,
            }),
            f"field_files_{file_field.id}": SimpleUploadedFile(
                "second.pdf", b"%PDF-1.4 second", content_type="application/pdf"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_manage_request_rejects_transition_from_finalized(
    api_client, lawyer_user, submitted_for_lawyer
):
    """Return 400 when attempting to transition a FINALIZED request to another status."""
    submitted_for_lawyer.status = "FINALIZED"
    submitted_for_lawyer.save(update_fields=["status"])

    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_for_lawyer.id}),
        {"status": "OPEN", "message": "reabrir"},
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_manage_request_rejects_unknown_current_status(
    api_client, lawyer_user, submitted_for_lawyer
):
    """Return 400 with status detail when the current status is not a known enum value."""
    # Bypass model validation via raw UPDATE so the view's guard for
    # out-of-enum statuses is exercised.
    ServiceRequest.objects.filter(id=submitted_for_lawyer.id).update(status="UNKNOWN_STATE")

    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_for_lawyer.id}),
        {"status": "OPEN", "message": "test"},
        format="multipart",
    )

    assert response.status_code == 400
    assert "Estado actual" in response.data["detail"]


@pytest.mark.django_db(transaction=True)
def test_save_file_replacement_runs_cleanup_on_commit(
    api_client, client_user, settings, tmp_path
):
    """Run the old-file cleanup callback on transaction commit when a file is replaced."""
    # transaction=True is required so transaction.on_commit callbacks actually
    # fire; the default rollback-based django_db mode never commits.
    import os
    settings.MEDIA_ROOT = str(tmp_path)
    service = Service.objects.create(
        name="Replace2", short_title="Rep2", slug="replace-svc-2", is_active=True
    )
    stage = ServiceStage.objects.create(service=service, title="S", order=1, is_active=True)
    file_field = ServiceField.objects.create(
        stage=stage, key="doc", label="Doc", field_type="file", is_required=False, order=1,
        allow_multiple_files=False, max_files=1, allowed_extensions=[".pdf"],
    )
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({"service_id": service.id, "answers": [], "is_submit": False}),
            f"field_files_{file_field.id}": SimpleUploadedFile("v1.pdf", b"%PDF-1.4 v1", content_type="application/pdf"),
        },
        format="multipart",
    )
    assert response.status_code == 200
    request_id = response.data["id"]

    from gym_app.models import ServiceRequestFieldFile
    first_path = ServiceRequestFieldFile.objects.get(service_request_id=request_id, field=file_field).file.path
    assert os.path.isfile(first_path)

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": service.id, "request_id": request_id,
                "answers": [], "is_submit": False,
            }),
            f"field_files_{file_field.id}": SimpleUploadedFile(
                "v2.pdf", b"%PDF-1.4 v2", content_type="application/pdf"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 200
    assert not os.path.isfile(first_path)
