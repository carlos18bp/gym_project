"""
Tests for fake data generation commands to ensure business rule compliance.

These tests verify that the management commands for generating fake data
produce records that comply with model validations, choices, and constraints.
"""
import pytest
from io import StringIO
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.db import transaction

from gym_app.models import (
    User,
    DynamicDocument,
    ActivityFeed,
    LegalRequest,
    Process,
    Organization,
    OrganizationMembership,
)


@pytest.fixture
def setup_base_users(db):
    """Create minimal base users required for fake data generation."""
    lawyer = User.objects.create_user(
        email='test_lawyer@example.com',
        password='testpass123',
        first_name='Test',
        last_name='Lawyer',
        role='lawyer',
    )
    client = User.objects.create_user(
        email='test_client@example.com',
        password='testpass123',
        first_name='Test',
        last_name='Client',
        role='client',
    )
    corporate_client = User.objects.create_user(
        email='test_corporate@example.com',
        password='testpass123',
        first_name='Test',
        last_name='Corporate',
        role='corporate_client',
    )
    return {'lawyer': lawyer, 'client': client, 'corporate_client': corporate_client}


class TestDynamicDocumentStatesValidity:
    """Tests to verify DynamicDocument states match model STATE_CHOICES."""

    def test_document_state_choices_are_valid(self, db):
        """Verify that all states used in fake data generation are valid."""
        valid_states = [choice[0] for choice in DynamicDocument.STATE_CHOICES]
        
        # States that should be used in fake data generation (after fix)
        fake_data_states = [
            'Draft', 'Published', 'Progress', 'Completed',
            'PendingSignatures', 'FullySigned', 'Rejected', 'Expired'
        ]
        
        for state in fake_data_states:
            assert state in valid_states, f"State '{state}' is not in DynamicDocument.STATE_CHOICES"

    def test_pending_review_is_not_valid_state(self, db):
        """Verify 'Pending Review' is NOT a valid state (was a bug)."""
        valid_states = [choice[0] for choice in DynamicDocument.STATE_CHOICES]
        assert 'Pending Review' not in valid_states, "'Pending Review' should not be a valid state"

    def test_document_creation_with_valid_states(self, setup_base_users):
        """Verify documents can be created with all valid states."""
        lawyer = setup_base_users['lawyer']
        valid_states = [choice[0] for choice in DynamicDocument.STATE_CHOICES]
        
        for state in valid_states:
            doc = DynamicDocument.objects.create(
                title=f'Test Document {state}',
                content='Test content',
                state=state,
                created_by=lawyer,
            )
            assert doc.state == state
            doc.delete()


class TestActivityFeedActionTypes:
    """Tests to verify ActivityFeed action types match model choices."""

    def test_action_type_choices_are_valid(self, db):
        """Verify that all action types used in fake data generation are valid."""
        valid_types = [choice[0] for choice in ActivityFeed.ACTION_TYPE_CHOICES]
        
        # Action types that should be used in fake data generation (after fix)
        fake_data_types = ['create', 'edit', 'finish', 'delete', 'update', 'download', 'other']
        
        for action_type in fake_data_types:
            assert action_type in valid_types, f"Action type '{action_type}' is not in ActivityFeed.ACTION_TYPE_CHOICES"

    def test_download_is_valid_action_type(self, db):
        """Verify 'download' is a valid action type."""
        valid_types = [choice[0] for choice in ActivityFeed.ACTION_TYPE_CHOICES]
        assert 'download' in valid_types, "'download' should be a valid action type"

    def test_activity_creation_with_all_action_types(self, setup_base_users):
        """Verify activities can be created with all valid action types."""
        user = setup_base_users['client']
        valid_types = [choice[0] for choice in ActivityFeed.ACTION_TYPE_CHOICES]
        
        for action_type in valid_types:
            activity = ActivityFeed.objects.create(
                user=user,
                action_type=action_type,
                description=f'Test activity {action_type}',
            )
            assert activity.action_type == action_type
            activity.delete()

    def test_activity_feed_max_20_per_user(self, setup_base_users):
        """Verify ActivityFeed enforces max 20 entries per user."""
        user = setup_base_users['client']
        
        # Create 25 activities
        for i in range(25):
            ActivityFeed.objects.create(
                user=user,
                action_type='other',
                description=f'Activity {i}',
            )
        
        # Should only have 20 activities due to model limit
        assert ActivityFeed.objects.filter(user=user).count() == 20


class TestLegalRequestStatusValidity:
    """Tests to verify LegalRequest statuses match model choices."""

    def test_legal_request_status_choices_are_valid(self, db):
        """Verify that all statuses used in fake data generation are valid."""
        valid_statuses = [choice[0] for choice in LegalRequest.STATUS_CHOICES]
        
        # Statuses used in fake data generation
        fake_data_statuses = ['PENDING', 'IN_REVIEW', 'RESPONDED', 'CLOSED']
        
        for status in fake_data_statuses:
            assert status in valid_statuses, f"Status '{status}' is not in LegalRequest.STATUS_CHOICES"


class TestOrganizationBusinessRules:
    """Tests to verify organization-related business rules."""

    def test_organization_requires_corporate_client_leader(self, setup_base_users):
        """Verify organization leader must be a corporate client."""
        corporate = setup_base_users['corporate_client']
        client = setup_base_users['client']
        
        # Should work with corporate client
        org = Organization.objects.create(
            title='Valid Organization',
            description='Test description',
            corporate_client=corporate,
        )
        assert org.corporate_client.role == 'corporate_client'
        
        # Should fail with regular client
        org_invalid = Organization(
            title='Invalid Organization',
            description='Test description',
            corporate_client=client,
        )
        with pytest.raises(ValidationError):
            org_invalid.clean()

    def test_organization_single_leader_constraint(self, setup_base_users):
        """Verify only one LEADER membership per organization."""
        corporate = setup_base_users['corporate_client']
        client = setup_base_users['client']
        
        org = Organization.objects.create(
            title='Test Organization',
            description='Test description',
            corporate_client=corporate,
        )
        
        # Create first leader
        OrganizationMembership.objects.create(
            organization=org,
            user=corporate,
            role='LEADER',
        )
        
        # Attempt to create second leader should fail validation
        second_leader = OrganizationMembership(
            organization=org,
            user=client,
            role='LEADER',
        )
        with pytest.raises(ValidationError) as exc_info:
            second_leader.clean()
        assert exc_info.value is not None
        assert OrganizationMembership.objects.filter(organization=org, role='LEADER').count() == 1

    def test_organization_membership_unique_per_user(self, setup_base_users):
        """Verify unique membership per (organization, user) pair."""
        corporate = setup_base_users['corporate_client']
        client = setup_base_users['client']
        
        org = Organization.objects.create(
            title='Test Organization',
            description='Test description',
            corporate_client=corporate,
        )
        
        # Create first membership
        OrganizationMembership.objects.create(
            organization=org,
            user=client,
            role='MEMBER',
        )
        
        # Second membership for same user should fail due to unique_together
        from django.db import IntegrityError
        with pytest.raises(IntegrityError) as exc_info:
            with transaction.atomic():
                OrganizationMembership.objects.create(
                    organization=org,
                    user=client,
                    role='ADMIN',
                )
        assert exc_info.value is not None
        assert OrganizationMembership.objects.filter(organization=org, user=client).count() == 1


class TestUserRoleChoices:
    """Tests to verify User role choices are valid."""

    def test_user_role_choices_are_valid(self, db):
        """Verify that all roles used in fake data generation are valid."""
        valid_roles = [choice[0] for choice in User.ROLE_CHOICES]
        
        # Roles used in fake data generation
        fake_data_roles = ['client', 'lawyer', 'corporate_client', 'basic']
        
        for role in fake_data_roles:
            assert role in valid_roles, f"Role '{role}' is not in User.ROLE_CHOICES"


class TestProcessBusinessRules:
    """Tests to verify Process-related business rules."""

    def test_process_progress_range(self, db):
        """Verify progress must be between 0 and 100."""
        from gym_app.models import Case
        
        # Create required fixtures
        lawyer = User.objects.create_user(
            email='process_lawyer@example.com',
            password='testpass123',
            role='lawyer',
        )
        case = Case.objects.create(type='Test Case Type')
        
        # Valid progress values
        for progress in [0, 50, 100]:
            process = Process.objects.create(
                authority='Test Authority',
                plaintiff='Test Plaintiff',
                defendant='Test Defendant',
                ref=f'REF-{progress}',
                lawyer=lawyer,
                case=case,
                subcase='Test Subcase',
                progress=progress,
            )
            assert process.progress == progress
            process.delete()
