import os

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from gym_app.models.user import User
from gym_app.models.organization import Organization, OrganizationMembership
from gym_app.models.corporate_request import (
    CorporateRequestType,
    CorporateRequestFiles,
    CorporateRequest,
    CorporateRequestResponse,
)


@pytest.fixture
@pytest.mark.django_db
def corporate_client():
    return User.objects.create_user(
        email="corp@example.com",
        password="testpassword",
        first_name="Corp",
        last_name="Client",
        role="corporate_client",
    )


@pytest.fixture
@pytest.mark.django_db
def normal_client():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        first_name="Normal",
        last_name="Client",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corporate_client):
    return Organization.objects.create(
        title="Org",
        description="Org desc",
        corporate_client=corporate_client,
    )


@pytest.fixture
@pytest.mark.django_db
def corporate_request_type():
    return CorporateRequestType.objects.create(name="Consulta")


@pytest.fixture
@pytest.mark.django_db
def corporate_request_file():
    test_file = SimpleUploadedFile(
        "corp_request.pdf",
        b"PDF content",
        content_type="application/pdf",
    )
    return CorporateRequestFiles.objects.create(file=test_file)


@pytest.mark.django_db
class TestCorporateRequestTypeAndFiles:
    def test_corporate_request_type_str(self, corporate_request_type):
        assert str(corporate_request_type) == "Consulta"

    def test_delete_corporate_request_file_removes_physical_file(self, corporate_request_file):
        file_path = corporate_request_file.file.path
        assert os.path.exists(file_path)

        corporate_request_file.delete()

        assert not os.path.exists(file_path)


@pytest.mark.django_db
class TestCorporateRequest:
    def test_corporate_request_auto_sets_corporate_client_and_generates_number(
        self,
        normal_client,
        corporate_client,
        organization,
        corporate_request_type,
    ):
        """Al guardar, debe auto-asignar corporate_client desde organization y generar request_number."""
        # Aseguramos que el cliente sea miembro activo de la organización
        OrganizationMembership.objects.create(
            organization=organization,
            user=normal_client,
            role="MEMBER",
        )

        request = CorporateRequest.objects.create(
            client=normal_client,
            organization=organization,
            corporate_client=None,  # Se debe autocompletar desde organization.corporate_client
            request_type=corporate_request_type,
            title="Solicitud",
            description="Descripción",
            priority="MEDIUM",
        )

        assert request.corporate_client == organization.corporate_client
        assert request.request_number is not None

        year = timezone.now().year
        assert request.request_number.startswith(f"CORP-{year}-")

    def test_corporate_request_request_number_increments_sequence(
        self,
        normal_client,
        corporate_client,
        organization,
        corporate_request_type,
    ):
        OrganizationMembership.objects.create(
            organization=organization,
            user=normal_client,
            role="MEMBER",
        )

        first = CorporateRequest.objects.create(
            client=normal_client,
            organization=organization,
            request_type=corporate_request_type,
            title="Primera",
            description="Primera",
            priority="LOW",
        )

        second = CorporateRequest.objects.create(
            client=normal_client,
            organization=organization,
            request_type=corporate_request_type,
            title="Segunda",
            description="Segunda",
            priority="LOW",
        )

        seq_first = int(first.request_number.split("-")[-1])
        seq_second = int(second.request_number.split("-")[-1])
        assert seq_second == seq_first + 1

    def test_corporate_request_clean_requires_client_membership(self, normal_client, corporate_client, organization, corporate_request_type):
        """El cliente debe ser miembro activo de la organización."""
        # No creamos OrganizationMembership para el cliente
        request = CorporateRequest(
            client=normal_client,
            organization=organization,
            corporate_client=corporate_client,
            request_type=corporate_request_type,
            title="Solicitud",
            description="Descripción",
            priority="MEDIUM",
        )

        with pytest.raises(ValidationError) as exc:
            request.clean()

        assert "miembro de la organización" in str(exc.value)

    def test_corporate_request_clean_requires_corporate_client_is_leader(self, normal_client, corporate_request_type):
        """El corporate_client debe ser el líder (corporate_client) de la organización."""
        other_corp = User.objects.create_user(
            email="other-corp@example.com",
            password="testpassword",
            first_name="Other",
            last_name="Corp",
            role="corporate_client",
        )
        organization = Organization.objects.create(
            title="Org",
            description="Org desc",
            corporate_client=other_corp,
        )

        # El corporate_client asignado no coincide con organization.corporate_client
        request = CorporateRequest(
            client=normal_client,
            organization=organization,
            corporate_client=User.objects.create_user(
                email="wrong@example.com",
                password="testpassword",
                role="corporate_client",
            ),
            request_type=corporate_request_type,
            title="Solicitud",
            description="Descripción",
            priority="MEDIUM",
        )

        with pytest.raises(ValidationError) as exc:
            request.clean()

        assert "cliente corporativo debe ser el líder" in str(exc.value)


@pytest.mark.django_db
class TestCorporateRequestResponse:
    def test_corporate_request_response_str(self, normal_client, corporate_client, organization, corporate_request_type):
        OrganizationMembership.objects.create(
            organization=organization,
            user=normal_client,
            role="MEMBER",
        )

        request = CorporateRequest.objects.create(
            client=normal_client,
            organization=organization,
            request_type=corporate_request_type,
            title="Solicitud",
            description="Descripción",
            priority="MEDIUM",
        )

        response = CorporateRequestResponse.objects.create(
            corporate_request=request,
            response_text="Respuesta",
            user=corporate_client,
            user_type="corporate_client",
            is_internal_note=True,
        )

        s = str(response)
        assert request.request_number in s
        assert "corporate_client response" in s


# ======================================================================
# Tests moved from test_model_consolidated.py
# ======================================================================

# ── CorporateRequestFiles str and signal ─────────────────────────────────────

@pytest.mark.django_db
class TestCorporateRequestFilesEdges:
    def test_files_str(self):
        f = SimpleUploadedFile("corp.pdf", b"x", content_type="application/pdf")
        crf = CorporateRequestFiles.objects.create(file=f)
        assert "corp" in str(crf)

    def test_delete_signal_removes_file(self):
        f = SimpleUploadedFile("rmcorp.pdf", b"x", content_type="application/pdf")
        crf = CorporateRequestFiles.objects.create(file=f)
        path = crf.file.path
        assert os.path.isfile(path)
        crf.delete()
        assert not os.path.isfile(path)


# ── CorporateRequest __str__ ────────────────────────────────────────────────


# ── CorporateRequest __str__ ────────────────────────────────────────────────

@pytest.mark.django_db
class TestCorporateRequestStr:
    def test_str(self, client_user, corporate_user, organization):
        OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
        )
        rt = CorporateRequestType.objects.create(name="Consulta")
        cr = CorporateRequest.objects.create(
            client=client_user, organization=organization,
            request_type=rt, title="Titulo", description="D",
        )
        s = str(cr)
        assert cr.request_number in s
        assert client_user.email in s


