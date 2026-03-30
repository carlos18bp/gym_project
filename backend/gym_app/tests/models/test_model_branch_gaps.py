"""Tests targeting partial branch gaps in model files.

Each test covers a specific branch path that was previously uncovered
(false-branch of conditionals in signals, clean(), save() overrides).
"""

from unittest.mock import MagicMock, patch

import pytest
from django.core.exceptions import ValidationError
from freezegun import freeze_time

from gym_app.models.user import ActivityFeed, User


# ---------------------------------------------------------------------------
# user.py — ActivityFeed.save: oldest_activity is None after filter (line 235)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestActivityFeedSaveBranch:
    """Test ActivityFeed.save branch when activity count is at or over limit."""

    def test_save_does_not_fail_when_under_limit(self):
        """No deletion when user has fewer than 20 activity entries."""
        user = User.objects.create_user(
            email="feed_under@example.com", password="pw", role="client"
        )
        ActivityFeed.objects.create(
            user=user,
            action_type="create_process",
            description="Test",
        )

        assert ActivityFeed.objects.filter(user=user).count() == 1

    @freeze_time("2026-01-15 12:00:00")
    def test_save_deletes_oldest_when_over_limit(self):
        """Delete oldest entry when count exceeds 20."""
        user = User.objects.create_user(
            email="feed_over@example.com", password="pw", role="client"
        )
        for i in range(20):
            ActivityFeed.objects.create(
                user=user,
                action_type="create_process",
                description=f"Entry {i}",
            )

        assert ActivityFeed.objects.filter(user=user).count() == 20

        ActivityFeed.objects.create(
            user=user,
            action_type="create_process",
            description="Entry 21 triggers trim",
        )

        assert ActivityFeed.objects.filter(user=user).count() == 20


# ---------------------------------------------------------------------------
# process.py — delete_file signal: instance.file is falsy (line 46)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCaseFileDeleteSignalBranch:
    """Test delete_file signal when CaseFile has no file attached."""

    def test_delete_signal_skips_when_file_is_empty(self):
        """Signal does nothing when CaseFile has no file attached."""
        from gym_app.models.process import CaseFile

        case_file = CaseFile.objects.create()

        pk = case_file.pk
        case_file.delete()

        assert not CaseFile.objects.filter(pk=pk).exists()


# ---------------------------------------------------------------------------
# corporate_request.py — delete signal: instance.file falsy (line 40)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCorporateRequestFileDeleteSignalBranch:
    """Test delete signal when CorporateRequestFiles has no file."""

    def test_delete_signal_skips_when_file_is_empty(self):
        """Signal does nothing when CorporateRequestFiles has no file."""
        from gym_app.models.corporate_request import CorporateRequestFiles

        crf = CorporateRequestFiles.objects.create()

        crf.delete()

        assert not CorporateRequestFiles.objects.filter(pk=crf.pk).exists()


# ---------------------------------------------------------------------------
# corporate_request.py — CorporateRequest.clean: validation branches (173-188)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCorporateRequestCleanBranches:
    """Test CorporateRequest.clean validation branches."""

    def test_clean_passes_when_client_and_org_both_set_and_valid(self):
        """Pass when client is a valid member of the organization."""
        from gym_app.models.corporate_request import (
            CorporateRequest,
            CorporateRequestType,
        )
        from gym_app.models.organization import Organization, OrganizationMembership

        corp_user = User.objects.create_user(
            email="corp_clean@example.com", password="pw", role="corporate_client"
        )
        client_user = User.objects.create_user(
            email="client_clean@example.com", password="pw", role="client"
        )
        org = Organization.objects.create(
            title="Test Org", corporate_client=corp_user
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True
        )
        rt = CorporateRequestType.objects.create(name="General")
        cr = CorporateRequest(
            organization=org,
            corporate_client=corp_user,
            client=client_user,
            request_type=rt,
        )

        cr.clean()

        # No ValidationError raised — clean passes
        assert cr.client == client_user
        assert cr.organization == org

    def test_clean_raises_when_corporate_client_not_leader(self):
        """Raise when corporate_client is not the org leader."""
        from gym_app.models.corporate_request import (
            CorporateRequest,
            CorporateRequestType,
        )
        from gym_app.models.organization import Organization

        corp_user = User.objects.create_user(
            email="corp_leader@example.com", password="pw", role="corporate_client"
        )
        other_corp = User.objects.create_user(
            email="corp_other@example.com", password="pw", role="corporate_client"
        )
        org = Organization.objects.create(
            title="Mismatch Org", corporate_client=corp_user
        )
        rt = CorporateRequestType.objects.create(name="General2")
        cr = CorporateRequest(
            organization=org,
            corporate_client=other_corp,
            client=corp_user,
            request_type=rt,
        )

        with pytest.raises(ValidationError) as exc_info:
            cr.clean()

        assert "cliente corporativo" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# legal_request.py — delete signal: instance.file falsy (line 41)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestLegalRequestFileDeleteSignalBranch:
    """Test delete signal when LegalRequestFiles has no file."""

    def test_delete_signal_skips_when_file_is_empty(self):
        """Signal does nothing when LegalRequestFiles has no file."""
        from gym_app.models.legal_request import LegalRequestFiles

        lrf = LegalRequestFiles.objects.create()

        lrf.delete()

        assert not LegalRequestFiles.objects.filter(pk=lrf.pk).exists()


# ---------------------------------------------------------------------------
# legal_request.py — save branch: request_number already set (line 92→exit)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestLegalRequestSaveBranch:
    """Test LegalRequest.save branch when request_number is pre-set."""

    def test_save_skips_number_generation_when_already_set(self):
        """Skip _generate_request_number when request_number is provided."""
        from gym_app.models.legal_request import (
            LegalDiscipline,
            LegalRequest,
            LegalRequestType,
        )

        user = User.objects.create_user(
            email="lr_save@example.com", password="pw", role="client"
        )
        rt = LegalRequestType.objects.create(name="Consulta")
        disc = LegalDiscipline.objects.create(name="General")
        lr = LegalRequest(
            user=user,
            request_type=rt,
            discipline=disc,
            description="Test description",
            request_number="SOL-CUSTOM-001",
        )
        lr.save()

        lr.refresh_from_db()
        assert lr.request_number == "SOL-CUSTOM-001"


# ---------------------------------------------------------------------------
# organization.py — delete_organization_images signal: both images falsy (97-103)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationDeleteImagesBranch:
    """Test delete_organization_images signal with missing images."""

    def test_delete_signal_skips_when_no_images(self):
        """Signal does nothing when organization has no images."""
        from gym_app.models.organization import Organization

        corp_user = User.objects.create_user(
            email="org_noimages@example.com", password="pw", role="corporate_client"
        )
        org = Organization.objects.create(
            title="No Images Org", corporate_client=corp_user
        )

        org.delete()

        assert not Organization.objects.filter(pk=org.pk).exists()

    def test_delete_signal_removes_profile_image_only(self):
        """Signal removes profile_image when cover_image is absent."""
        from gym_app.models.organization import Organization

        corp_user = User.objects.create_user(
            email="org_profile_only@example.com", password="pw", role="corporate_client"
        )
        org = Organization.objects.create(
            title="Profile Only Org", corporate_client=corp_user
        )
        org.profile_image = MagicMock()
        org.profile_image.path = "/fake/profile.jpg"

        with patch("gym_app.models.organization.os.path.isfile", return_value=False) as mock_isfile:
            org.delete()

        mock_isfile.assert_called_once_with("/fake/profile.jpg")
        assert not Organization.objects.filter(pk=org.pk).exists()


# ---------------------------------------------------------------------------
# organization.py — OrganizationInvitation.clean: skip leader check (190→exit)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationInvitationCleanBranch:
    """Test OrganizationInvitation.clean leader check branch."""

    def test_clean_skips_leader_check_when_invited_by_is_leader(self):
        """Pass validation when invited_by is the actual org leader."""
        from gym_app.models.organization import Organization, OrganizationInvitation

        corp_user = User.objects.create_user(
            email="inv_clean@example.com", password="pw", role="corporate_client"
        )
        invited = User.objects.create_user(
            email="inv_target@example.com", password="pw", role="client"
        )
        org = Organization.objects.create(
            title="Inv Org", corporate_client=corp_user
        )

        invitation = OrganizationInvitation(
            organization=org,
            invited_user=invited,
            invited_by=corp_user,
        )

        invitation.clean()

        # No ValidationError raised — invited_by is the org leader
        assert invitation.invited_by == corp_user
        assert invitation.organization.corporate_client == corp_user


# ---------------------------------------------------------------------------
# organization.py — OrganizationMembership.clean: role != LEADER (304→exit)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationMembershipCleanBranch:
    """Test OrganizationMembership.clean when role is not LEADER."""

    def test_clean_skips_leader_check_for_member_role(self):
        """No leader uniqueness check when role is MEMBER."""
        from gym_app.models.organization import Organization, OrganizationMembership

        corp_user = User.objects.create_user(
            email="memb_clean@example.com", password="pw", role="corporate_client"
        )
        member_user = User.objects.create_user(
            email="memb_user@example.com", password="pw", role="client"
        )
        org = Organization.objects.create(
            title="Memb Org", corporate_client=corp_user
        )
        membership = OrganizationMembership(
            organization=org, user=member_user, role="MEMBER"
        )

        membership.clean()

        # No ValidationError raised — MEMBER role skips leader uniqueness check
        assert membership.role == "MEMBER"


# ---------------------------------------------------------------------------
# organization.py — OrganizationPost.clean: author/org None branches (402, 407)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationPostCleanBranch:
    """Test OrganizationPost.clean validation branches."""

    def test_clean_skips_leader_check_when_author_is_leader(self):
        """Pass leader check when author is the org leader."""
        from gym_app.models.organization import Organization, OrganizationPost

        corp_user = User.objects.create_user(
            email="post_leader@example.com", password="pw", role="corporate_client"
        )
        org = Organization.objects.create(
            title="Post Org Leader", corporate_client=corp_user
        )
        post = OrganizationPost(
            author=corp_user,
            organization=org,
            title="Valid Post",
        )

        post.clean()

        # No ValidationError raised — author is the org leader
        assert post.author == corp_user
        assert post.organization.corporate_client == corp_user

    def test_clean_raises_when_link_name_without_url(self):
        """Raise ValidationError when link_name is set but link_url is empty."""
        from gym_app.models.organization import Organization, OrganizationPost

        corp_user = User.objects.create_user(
            email="post_link@example.com", password="pw", role="corporate_client"
        )
        org = Organization.objects.create(
            title="Post Org", corporate_client=corp_user
        )
        post = OrganizationPost(
            author=corp_user,
            organization=org,
            title="Test Post",
            link_name="Click here",
            link_url="",
        )

        with pytest.raises(ValidationError) as exc_info:
            post.clean()

        assert "nombre de enlace" in str(exc_info.value).lower() or "URL" in str(exc_info.value)

    def test_clean_raises_when_link_url_without_name(self):
        """Raise ValidationError when link_url is set but link_name is empty."""
        from gym_app.models.organization import Organization, OrganizationPost

        corp_user = User.objects.create_user(
            email="post_url@example.com", password="pw", role="corporate_client"
        )
        org = Organization.objects.create(
            title="Post Org URL", corporate_client=corp_user
        )
        post = OrganizationPost(
            author=corp_user,
            organization=org,
            title="Test Post URL",
            link_url="https://example.com",
            link_name="",
        )

        with pytest.raises(ValidationError) as exc_info:
            post.clean()

        assert "nombre" in str(exc_info.value).lower() or "URL" in str(exc_info.value)


# ---------------------------------------------------------------------------
# dynamic_document.py — DynamicDocument.delete: folder_count == 0 (line 461)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDynamicDocumentDeleteBranch:
    """Test DynamicDocument.delete when document has no folders."""

    def test_delete_with_no_folders(self):
        """Delete succeeds when document has no folders (folder_count == 0)."""
        from gym_app.models.dynamic_document import DynamicDocument

        lawyer = User.objects.create_user(
            email="dd_del@example.com", password="pw", role="lawyer"
        )
        doc = DynamicDocument.objects.create(
            title="No Folders Doc",
            created_by=lawyer,
        )

        doc.delete()

        assert not DynamicDocument.objects.filter(pk=doc.pk).exists()
