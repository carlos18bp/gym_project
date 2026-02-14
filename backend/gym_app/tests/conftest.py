"""
Shared fixtures for gym_app tests.

These fixtures are available to all test files under gym_app/tests/.
Local fixtures in individual test files take precedence over these.
"""
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.test import RequestFactory

from gym_app.models import (
    Case,
    DynamicDocument,
    Organization,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Pre-configured DRF APIClient."""
    return APIClient()


@pytest.fixture
def rf():
    """Django RequestFactory."""
    return RequestFactory()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    """Lawyer role user."""
    return User.objects.create_user(
        email="lawyer_conftest@test.com",
        password="testpassword",
        first_name="Lawyer",
        last_name="Conftest",
        role="lawyer",
        is_gym_lawyer=True,
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    """Client role user."""
    return User.objects.create_user(
        email="client_conftest@test.com",
        password="testpassword",
        first_name="Client",
        last_name="Conftest",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    """Basic (free-tier) role user."""
    return User.objects.create_user(
        email="basic_conftest@test.com",
        password="testpassword",
        first_name="Basic",
        last_name="Conftest",
        role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def corporate_user():
    """Corporate-client role user."""
    return User.objects.create_user(
        email="corporate_conftest@test.com",
        password="testpassword",
        first_name="Corporate",
        last_name="Conftest",
        role="corporate_client",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corporate_user):
    """Organization owned by corporate_user."""
    return Organization.objects.create(
        title="ConftestOrg",
        description="Conftest test organization",
        corporate_client=corporate_user,
        is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def case_type():
    """A Case (case type) instance."""
    return Case.objects.create(type="Civil")


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    """A DynamicDocument in Draft state owned by lawyer_user."""
    return DynamicDocument.objects.create(
        title="ConftestDoc",
        content="<p>conftest test content</p>",
        state="Draft",
        created_by=lawyer_user,
    )
