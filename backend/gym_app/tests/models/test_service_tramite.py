"""Unit tests for gym_app.models.service_tramite.

Focus on branches not reached by the view/serializer suites:
- __str__ methods on every model
- Auto-slug on Service.save
- ServiceField.clean() validations (select options, max_files, allowed_extensions)
- ServiceRequest tracking-number / mark_submitted idempotency
- post_delete signal handlers removing files from disk
"""

import os

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

from gym_app.models import (
    Service,
    ServiceField,
    ServiceRequest,
    ServiceRequestAnswer,
    ServiceRequestFieldFile,
    ServiceRequestLawyerResponse,
    ServiceRequestLawyerResponseFile,
    ServiceStage,
)
from gym_app.models.service_tramite import ServiceRequestSequence

User = get_user_model()


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------


@pytest.fixture
def requester():
    """Create a client user as the service request requester."""
    return User.objects.create_user(
        email="requester_model@test.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def service():
    """Create a basic Service instance for model tests."""
    svc = Service.objects.create(name="Test Service", short_title="Test", slug="test-svc-m")
    return svc


@pytest.fixture
def stage(service):
    """Create a ServiceStage for the given service."""
    return ServiceStage.objects.create(service=service, title="Etapa", order=1)


@pytest.fixture
def field(stage):
    """Create an input ServiceField for the given stage."""
    return ServiceField.objects.create(stage=stage, key="nombre", label="Nombre", order=1)


# ------------------------------------------------------------------
# Service.save auto-slug + __str__
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_service_save_auto_slugs_from_short_title_when_slug_missing():
    """Auto-slug from short_title when slug is blank on save."""
    svc = Service(name="Registro de Marcas", short_title="Registro Marca")
    svc.save()

    assert svc.slug == "registro-marca"


@pytest.mark.django_db
def test_service_save_falls_back_to_name_when_short_title_missing():
    """Fall back to name-based slug when short_title is blank."""
    svc = Service(name="Solo Nombre", short_title="")
    svc.save()

    assert svc.slug == "solo-nombre"


@pytest.mark.django_db
def test_service_str_returns_name(service):
    """Return service name from __str__."""
    assert str(service) == service.name


# ------------------------------------------------------------------
# ServiceStage.__str__
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_service_stage_str_includes_service_short_title_and_order(service, stage):
    """Include service short_title, stage order and title in ServiceStage.__str__."""
    assert str(stage) == f"{service.short_title} - Etapa {stage.order}: {stage.title}"


# ------------------------------------------------------------------
# ServiceField.clean() / save()
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_service_field_rejects_select_without_options(stage):
    """Reject select_single field when options is None."""
    f = ServiceField(
        stage=stage, key="tipo", label="Tipo", field_type="select_single", options=None, order=9
    )
    with pytest.raises(ValidationError) as exc:
        f.save()
    assert "options" in exc.value.message_dict


@pytest.mark.django_db
def test_service_field_rejects_max_files_below_one(stage):
    """Reject file field when max_files is below 1."""
    f = ServiceField(
        stage=stage, key="doc", label="Doc", field_type="file", max_files=0, order=9
    )
    with pytest.raises(ValidationError) as exc:
        f.save()
    assert "max_files" in exc.value.message_dict


@pytest.mark.django_db
def test_service_field_rejects_allowed_extensions_when_not_list(stage):
    """Reject file field when allowed_extensions is not a list."""
    f = ServiceField(
        stage=stage, key="doc", label="Doc", field_type="file",
        allowed_extensions={"ext": ".pdf"}, max_files=1, order=9,
    )
    with pytest.raises(ValidationError) as exc:
        f.save()
    assert "allowed_extensions" in exc.value.message_dict


@pytest.mark.django_db
def test_service_field_str_includes_service_and_label(service, field):
    """Include service short_title and field label in ServiceField.__str__."""
    assert str(field) == f"{service.short_title} - {field.label}"


# ------------------------------------------------------------------
# ServiceRequestSequence.__str__
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_service_request_sequence_str():
    """Return year and last_value from ServiceRequestSequence.__str__."""
    seq = ServiceRequestSequence.objects.create(year=2099, last_value=42)
    assert str(seq) == "2099: 42"


# ------------------------------------------------------------------
# ServiceRequest.assign_tracking_number / mark_submitted / __str__
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_assign_tracking_number_is_idempotent(service, requester):
    """Return the same tracking number on repeated calls to assign_tracking_number."""
    req = ServiceRequest.objects.create(service=service, requester=requester)
    first = req.assign_tracking_number()

    second = req.assign_tracking_number()

    assert first == second


@pytest.mark.django_db
def test_mark_submitted_is_idempotent(service, requester):
    """Skip re-submission when is_submitted is already True."""
    req = ServiceRequest.objects.create(service=service, requester=requester, is_submitted=True)
    req.submitted_at = None
    req.mark_submitted()

    # Early-return path: submitted_at should stay None because is_submitted was already True
    assert req.submitted_at is None


@pytest.mark.django_db
def test_service_request_str_returns_draft_label_when_no_tracking_number(service, requester):
    """Return BORRADOR-{id} from __str__ when no tracking number is assigned."""
    req = ServiceRequest.objects.create(service=service, requester=requester)

    assert str(req) == f"BORRADOR-{req.id}"


@pytest.mark.django_db
def test_service_request_str_returns_tracking_number_when_assigned(service, requester):
    """Return the tracking number from __str__ once one is assigned."""
    req = ServiceRequest.objects.create(service=service, requester=requester)
    req.assign_tracking_number()

    assert str(req) == req.tracking_number


# ------------------------------------------------------------------
# ServiceRequestAnswer.__str__
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_service_request_answer_str(service, requester, field):
    """Return '{request_id}::{field_key}' from ServiceRequestAnswer.__str__."""
    req = ServiceRequest.objects.create(service=service, requester=requester)
    answer = ServiceRequestAnswer.objects.create(
        service_request=req,
        field=field,
        field_key=field.key,
        field_label=field.label,
        field_type="input",
        stage_title="E",
        stage_order=1,
    )

    assert str(answer) == f"{req.id}::{field.key}"


# ------------------------------------------------------------------
# ServiceRequestFieldFile.__str__ — original_name and fallback to file basename
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_field_file_str_falls_back_to_file_basename(
    service, requester, field, settings, tmp_path
):
    """Return the file basename from ServiceRequestFieldFile.__str__ when original_name is None."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    ff = ServiceRequestFieldFile(service_request=req, field=field, original_name=None)
    ff.file.save("raw.pdf", ContentFile(b"%PDF"), save=False)
    ff.save()

    assert str(ff) == os.path.basename(ff.file.name)


# ------------------------------------------------------------------
# ServiceRequestLawyerResponse/File __str__
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_lawyer_response_str_shows_status_transition(service, requester):
    """Return '{request_id}: {before} -> {after}' from ServiceRequestLawyerResponse.__str__."""
    req = ServiceRequest.objects.create(service=service, requester=requester)
    resp = ServiceRequestLawyerResponse.objects.create(
        service_request=req, message="m", status_before="OPEN", status_after="IN_STUDY"
    )

    assert str(resp) == f"{req.id}: OPEN -> IN_STUDY"


@pytest.mark.django_db
def test_lawyer_response_file_str_falls_back_to_basename(
    service, requester, settings, tmp_path
):
    """Return the file basename from ServiceRequestLawyerResponseFile.__str__ when original_name is None."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    resp = ServiceRequestLawyerResponse.objects.create(
        service_request=req, message="m", status_before="OPEN", status_after="IN_STUDY"
    )
    rf = ServiceRequestLawyerResponseFile(response=resp, original_name=None)
    rf.file.save("r.pdf", ContentFile(b"R"), save=False)
    rf.save()

    assert str(rf) == os.path.basename(rf.file.name)


# ------------------------------------------------------------------
# post_delete signal handlers remove physical files from disk
# ------------------------------------------------------------------


@pytest.mark.django_db
def test_deleting_field_file_removes_physical_file(
    service, requester, field, settings, tmp_path
):
    """Remove the physical file from disk when a ServiceRequestFieldFile is deleted."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    ff = ServiceRequestFieldFile(service_request=req, field=field, original_name="x.pdf")
    ff.file.save("x.pdf", ContentFile(b"bytes"), save=False)
    ff.save()
    path = ff.file.path
    assert os.path.isfile(path)

    ff.delete()

    assert not os.path.isfile(path)


@pytest.mark.django_db
def test_deleting_response_file_removes_physical_file(
    service, requester, settings, tmp_path
):
    """Remove the physical file from disk when a ServiceRequestLawyerResponseFile is deleted."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    resp = ServiceRequestLawyerResponse.objects.create(
        service_request=req, message="m", status_before="OPEN", status_after="IN_STUDY"
    )
    rf = ServiceRequestLawyerResponseFile(response=resp, original_name="r.pdf")
    rf.file.save("r.pdf", ContentFile(b"body"), save=False)
    rf.save()
    path = rf.file.path
    assert os.path.isfile(path)

    rf.delete()

    assert not os.path.isfile(path)


@pytest.mark.django_db
def test_deleting_service_request_removes_generated_document(
    service, requester, settings, tmp_path
):
    """Remove the generated_document file from disk when a ServiceRequest is deleted."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    req.generated_document.save("doc.pdf", ContentFile(b"%PDF"), save=False)
    req.save()
    path = req.generated_document.path
    assert os.path.isfile(path)

    req.delete()

    assert not os.path.isfile(path)


@pytest.mark.django_db
def test_deleting_response_file_without_disk_file_does_not_error(
    service, requester, settings, tmp_path
):
    """Signal handler skips os.remove when the physical file is already gone."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    resp = ServiceRequestLawyerResponse.objects.create(
        service_request=req, message="m", status_before="OPEN", status_after="IN_STUDY"
    )
    rf = ServiceRequestLawyerResponseFile(response=resp, original_name="r.pdf")
    rf.file.save("gone.pdf", ContentFile(b"body"), save=False)
    rf.save()
    os.unlink(rf.file.path)

    rf.delete()

    assert not ServiceRequestLawyerResponseFile.objects.filter(pk=rf.pk).exists()


@pytest.mark.django_db
def test_deleting_service_request_without_disk_document_does_not_error(
    service, requester, settings, tmp_path
):
    """Signal handler skips os.remove when generated_document file is already gone."""
    settings.MEDIA_ROOT = str(tmp_path)
    req = ServiceRequest.objects.create(service=service, requester=requester)
    req.generated_document.save("vanished.pdf", ContentFile(b"%PDF"), save=False)
    req.save()
    os.unlink(req.generated_document.path)
    req_pk = req.pk

    req.delete()

    assert not ServiceRequest.objects.filter(pk=req_pk).exists()
