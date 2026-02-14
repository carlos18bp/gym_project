import os

import pytest
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentVariable, DocumentFolder,
    DocumentVisibilityPermission, DocumentUsabilityPermission,
    RecentDocument, Tag,
)
from gym_app.models.user import User

@pytest.fixture
def user():
    """Create a user for testing"""
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword',
        first_name='Test',
        last_name='User'
    )

@pytest.fixture
def document(user):
    """Create a dynamic document for testing"""
    return DynamicDocument.objects.create(
        title='Test Document',
        content='<p>This is a test document with {{variable1}} and {{variable2}}.</p>',
        state='Draft',
        created_by=user
    )

@pytest.fixture
def document_variable(document):
    """Create a document variable for testing"""
    return DocumentVariable.objects.create(
        document=document,
        name_en='variable1',
        name_es='variable1_es',
        tooltip='Variable 1 tooltip',
        field_type='input',
        value='Test Value'
    )

@pytest.mark.django_db
class TestDynamicDocument:
    
    def test_create_document(self, user):
        """Test creating a dynamic document"""
        document = DynamicDocument.objects.create(
            title='New Document',
            content='<p>Content with {{variable}}.</p>',
            state='Draft',
            created_by=user
        )
        
        assert document.id is not None
        assert document.title == 'New Document'
        assert document.content == '<p>Content with {{variable}}.</p>'
        assert document.state == 'Draft'
        assert document.created_by == user
        assert document.created_at is not None
        assert document.updated_at is not None
        
    def test_document_state_choices(self, document):
        """Test document state choices validation"""
        # Valid state update
        document.state = 'Published'
        document.save()
        document.refresh_from_db()
        assert document.state == 'Published'
        
        # Valid state update
        document.state = 'Progress'
        document.save()
        document.refresh_from_db()
        assert document.state == 'Progress'
        
        # Valid state update
        document.state = 'Completed'
        document.save()
        document.refresh_from_db()
        assert document.state == 'Completed'
        
    def test_document_str_representation(self, document):
        """Test string representation of document"""
        assert str(document) == document.title
    
    def test_document_assign_to_user(self, document, user):
        """Test assigning document to a user"""
        another_user = User.objects.create_user(
            email='another@example.com',
            password='anotherpassword',
            first_name='Another',
            last_name='User'
        )
        
        document.assigned_to = another_user
        document.save()
        document.refresh_from_db()
        
        assert document.assigned_to == another_user
        assert document.assigned_to.email == 'another@example.com'

@pytest.mark.django_db
class TestDocumentVariable:
    
    def test_create_document_variable(self, document):
        """Test creating a document variable"""
        variable = DocumentVariable.objects.create(
            document=document,
            name_en='new_variable',
            name_es='nueva_variable',
            tooltip='New variable tooltip',
            field_type='text_area',
            value='New Test Value'
        )
        
        assert variable.id is not None
        assert variable.name_en == 'new_variable'
        assert variable.name_es == 'nueva_variable'
        assert variable.tooltip == 'New variable tooltip'
        assert variable.field_type == 'text_area'
        assert variable.value == 'New Test Value'
        assert variable.document == document
    
    def test_document_variable_field_type_choices(self, document_variable):
        """Test document variable field type choices validation"""
        # Valid field type update
        document_variable.field_type = 'text_area'
        document_variable.save()
        document_variable.refresh_from_db()
        assert document_variable.field_type == 'text_area'
        
        # Valid field type update
        document_variable.field_type = 'input'
        document_variable.save()
        document_variable.refresh_from_db()
        assert document_variable.field_type == 'input'
    
    def test_document_variable_str_representation(self, document_variable):
        """Test string representation of document variable"""
        assert str(document_variable) == document_variable.name_en
    
    def test_document_with_multiple_variables(self, document, document_variable):
        """Test a document with multiple variables"""
        # Create multiple variables for the document
        variables = [
            DocumentVariable.objects.create(
                document=document,
                name_en=f'variable{i}',
                name_es=f'variable{i}_es',
                tooltip=f'Variable {i} tooltip',
                field_type='input' if i % 2 == 0 else 'text_area',
                value=f'Value {i}'
            )
            for i in range(1, 4)  # Create 3 variables
        ]
        
        # Verify the variables were created and associated with the document
        document_variables = document.variables.all()
        assert document_variables.count() == 4  # 3 new + 1 from fixture
        
        # Verify each variable has correct data
        variable_names = [var.name_en for var in document_variables]
        assert document_variable.name_en in variable_names
        for i in range(1, 4):
            assert f'variable{i}' in variable_names


# ======================================================================
@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="lawyer-b1@example.com", password="testpassword",
        first_name="Lawyer", last_name="B1", role="lawyer",
    )


# Tests moved from test_model_consolidated.py
# ======================================================================


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
            requires_signature=kwargs.pop("requires_signature", False),
        )
    return create_document


# ── DocumentVariable.clean validation ────────────────────────────────────────

@pytest.mark.django_db
class TestDocumentVariableClean:
    def test_clean_number_invalid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="number", value="abc",
        )
        with pytest.raises(ValidationError):
            var.clean()

    def test_clean_date_invalid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="date", value="not-a-date",
        )
        with pytest.raises(ValidationError):
            var.clean()

    def test_clean_email_invalid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="email", value="bad-email",
        )
        with pytest.raises(ValidationError):
            var.clean()

    def test_clean_number_valid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="number", value="42.5",
        )
        var.clean()  # should not raise

    def test_clean_date_valid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="date", value="2024-01-15",
        )
        var.clean()  # should not raise

    def test_clean_email_valid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="email", value="ok@example.com",
        )
        var.clean()  # should not raise


# ── DocumentVariable.get_formatted_value ─────────────────────────────────────


# ── DocumentVariable.get_formatted_value ─────────────────────────────────────

@pytest.mark.django_db
class TestDocumentVariableFormattedValue:
    def test_non_value_field_returns_raw(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="none", value="hello",
        )
        assert var.get_formatted_value() == "hello"

    def test_value_without_currency(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", value="1000000", currency=None,
        )
        result = var.get_formatted_value()
        assert "1.000.000" in result

    def test_value_usd_currency(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", currency="USD", value="500",
        )
        result = var.get_formatted_value()
        assert "US $" in result

    def test_value_eur_currency(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", currency="EUR", value="250",
        )
        result = var.get_formatted_value()
        assert "EUR" in result

    def test_empty_string_value(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", value="",
        )
        assert var.get_formatted_value() == ""


# ── Tag, DocumentFolder, RecentDocument str / basics ─────────────────────────


# ── Tag, DocumentFolder, RecentDocument str / basics ─────────────────────────

@pytest.mark.django_db
class TestTagAndFolderAndRecentDoc:
    def test_tag_str(self, lawyer):
        tag = Tag.objects.create(name="Important", created_by=lawyer)
        assert str(tag) == "Important"

    def test_document_folder_str(self, client_user):
        folder = DocumentFolder.objects.create(name="MyFolder", owner=client_user)
        assert "MyFolder" in str(folder)
        assert client_user.email in str(folder)

    def test_recent_document_str(self, lawyer):
        doc = DynamicDocument.objects.create(title="RD", content="C", created_by=lawyer)
        rd = RecentDocument.objects.create(user=lawyer, document=doc)
        assert "RD" in str(rd)


# ── DocumentVisibilityPermission / DocumentUsabilityPermission str ──────────


# ---------------------------------------------------------------------------
# dynamic_document.py – currency formatting behavior
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDocumentVariableCurrencyFormatting:
    def test_get_formatted_value_whole_number_cop(self, document):
        """
        Whole-number COP values are formatted with thousands separators
        and two decimal places.
        """
        var = DocumentVariable.objects.create(
            document=document,
            name_en="amount",
            field_type="input",
            value="1000000",
            summary_field="value",
            currency="COP",
        )

        result = var.get_formatted_value()

        assert result == "COP $ 1.000.000.00"
        assert "," not in result


# ---------------------------------------------------------------------------
# legal_request.py – line 121: __str__ when self.user is None
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_document_variable_invalid_number_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser un"):
        DocumentVariable.objects.create(
            document=document,
            name_en="amount",
            field_type="number",
            value="not-a-number",
        )


@pytest.mark.django_db
def test_document_variable_invalid_date_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser una fecha"):
        DocumentVariable.objects.create(
            document=document,
            name_en="start",
            field_type="date",
            value="2023/01/01",
        )


@pytest.mark.django_db
def test_document_variable_invalid_email_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser un correo"):
        DocumentVariable.objects.create(
            document=document,
            name_en="email",
            field_type="email",
            value="not-an-email",
        )


@pytest.mark.django_db
def test_document_variable_valid_number_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        value="1234.56",
    )

    assert variable.id is not None


@pytest.mark.django_db
def test_document_variable_valid_date_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="start_date",
        field_type="date",
        value="2024-01-31",
    )

    assert variable.id is not None


@pytest.mark.django_db
def test_document_variable_valid_email_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="contact_email",
        field_type="email",
        value="person@example.com",
    )

    assert variable.id is not None


@pytest.mark.django_db
def test_document_variable_get_formatted_value_usd_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        currency="USD",
        value="1000",
    )

    assert variable.get_formatted_value() == "US $ 1.000.00"


@pytest.mark.django_db
def test_document_variable_get_formatted_value_returns_raw_when_not_value(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="notes",
        field_type="input",
        summary_field="none",
        value="Some notes",
    )

    assert variable.get_formatted_value() == "Some notes"


@pytest.mark.django_db
def test_document_variable_get_formatted_value_without_currency_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        value="1000",
    )

    assert variable.get_formatted_value() == "1.000.00"


@pytest.mark.django_db
def test_document_variable_get_formatted_value_unknown_currency_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        currency="GBP",
        value="1000",
    )

    assert variable.get_formatted_value() == "GBP 1.000.00"


@pytest.mark.django_db
def test_recent_document_str(user_factory, document_factory):
    user = user_factory("recent@example.com")
    document = document_factory(created_by=user, title="Recent Doc")

    recent = RecentDocument.objects.create(user=user, document=document)

    assert user.email in str(recent)
    assert document.title in str(recent)


@pytest.mark.django_db
def test_recent_document_unique_together(user_factory, document_factory):
    user = user_factory("unique@example.com")
    document = document_factory(created_by=user)

    RecentDocument.objects.create(user=user, document=document)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            RecentDocument.objects.create(user=user, document=document)


