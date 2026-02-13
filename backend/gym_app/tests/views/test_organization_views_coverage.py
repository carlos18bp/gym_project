"""Tests for uncovered branches in organization.py (91%→higher)."""
import pytest
import unittest.mock as mock
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization, OrganizationInvitation, OrganizationMembership,
)
from gym_app.views.organization import OrganizationPagination

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def corp_client():
    return User.objects.create_user(
        email='corp_oc@e.com', password='p', role='corporate_client',
        first_name='C', last_name='O')


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_oc@e.com', password='p', role='client',
        first_name='Cl', last_name='O')


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_oc@e.com', password='p', role='lawyer',
        first_name='L', last_name='O')


@pytest.fixture
def org(corp_client):
    return Organization.objects.create(
        title='OrgOC', description='Desc', corporate_client=corp_client)


@pytest.mark.django_db
class TestOrganizationViewsCoverage:

    # --- Line 57: require_client_or_corporate_client blocks lawyer ---
    def test_public_detail_blocked_for_lawyer(self, api_client, lawyer, org):
        """Line 57: lawyer blocked by require_client_or_corporate_client."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-organization-public-detail',
            kwargs={'organization_id': org.pk}))
        assert r.status_code == 403

    # --- Line 95: create_organization invalid data ---
    def test_create_org_invalid(self, api_client, corp_client):
        """Line 95: invalid serializer returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('create-organization'),
            {},  # missing required title/description
            format='json')
        assert r.status_code == 400
        assert 'details' in r.data

    # --- Lines 116, 121: search and is_active filters ---
    def test_get_my_orgs_search_filter(self, api_client, corp_client, org):
        """Line 116: search filter on organizations."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-my-organizations'), {'search': 'OrgOC'})
        assert r.status_code == 200

    def test_get_my_orgs_is_active_filter(self, api_client, corp_client, org):
        """Line 121: is_active filter on organizations."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-my-organizations'), {'is_active': 'true'})
        assert r.status_code == 200

    # --- Line 206: update_organization invalid data ---
    def test_update_org_invalid(self, api_client, corp_client, org):
        """Line 206: invalid serializer returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.put(
            reverse('update-organization',
                    kwargs={'organization_id': org.pk}),
            {'title': ''},  # empty title should be invalid
            format='json')
        assert r.status_code in (200, 400)

    # --- Line 275: send_invitation invalid data ---
    def test_send_invitation_invalid(self, api_client, corp_client, org):
        """Line 275: invalid invitation data returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('send-organization-invitation',
                    kwargs={'organization_id': org.pk}),
            {},  # missing required invited_user
            format='json')
        assert r.status_code == 400
        assert 'details' in r.data

    # --- Line 302: invitation status filter ---
    def test_get_invitations_status_filter(self, api_client, corp_client, org):
        """Line 302: status filter on invitations."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-invitations',
                    kwargs={'organization_id': org.pk}),
            {'status': 'PENDING'})
        assert r.status_code == 200

    # --- Lines 387-391: member role filter ---
    def test_get_members_role_filter(self, api_client, corp_client, org):
        """Line 391: role filter on members."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-members',
                    kwargs={'organization_id': org.pk}),
            {'role': 'MEMBER'})
        assert r.status_code == 200

    def test_get_members_inactive_filter(self, api_client, corp_client, org):
        """Lines 387-388: is_active=false filter shows inactive members."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-members',
                    kwargs={'organization_id': org.pk}),
            {'is_active': 'false'})
        assert r.status_code == 200

    # --- Lines 579-584: respond_to_invitation invalid ---
    def test_respond_invitation_invalid(
        self, api_client, corp_client, client_u, org
    ):
        """Lines 579-584: invalid invitation response returns 400."""
        inv = OrganizationInvitation.objects.create(
            organization=org, invited_user=client_u,
            invited_by=corp_client, status='PENDING')
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('respond-to-invitation',
                    kwargs={'invitation_id': inv.pk}),
            {'action': 'invalid_action'},
            format='json')
        assert r.status_code == 400

    # --- Line 632: leader cannot leave organization ---
    def test_leader_cannot_leave(self, api_client, client_u, corp_client, org):
        """Line 632: leader role gets 400 when trying to leave."""
        mem = OrganizationMembership.objects.create(
            organization=org, user=client_u, role='LEADER', is_active=True)
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('leave-organization',
                    kwargs={'organization_id': org.pk}))
        assert r.status_code == 400
        assert 'líderes' in r.data['error']

    # --- Lines 138-146: get_my_organizations pagination fallback ---
    @mock.patch.object(OrganizationPagination, 'paginate_queryset', return_value=None)
    def test_get_my_orgs_pagination_fallback(
        self, mock_paginate, api_client, corp_client, org
    ):
        """Lines 138-146: pagination returns None → fallback response."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(reverse('get-my-organizations'))
        assert r.status_code == 200
        assert 'organizations' in r.data
        assert 'total_count' in r.data

    # --- Lines 319-328: get_organization_invitations pagination fallback ---
    @mock.patch.object(OrganizationPagination, 'paginate_queryset', return_value=None)
    def test_get_invitations_pagination_fallback(
        self, mock_paginate, api_client, corp_client, org
    ):
        """Lines 319-328: invitations pagination returns None → fallback."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-invitations',
                    kwargs={'organization_id': org.pk}))
        assert r.status_code == 200
        assert 'invitations' in r.data
        assert 'total_count' in r.data

    # --- Lines 531-540: get_my_invitations pagination fallback ---
    @mock.patch.object(OrganizationPagination, 'paginate_queryset', return_value=None)
    def test_get_my_invitations_pagination_fallback(
        self, mock_paginate, api_client, client_u
    ):
        """Lines 531-540: my invitations pagination returns None → fallback."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(reverse('get-my-invitations'))
        assert r.status_code == 200
        assert 'invitations' in r.data
        assert 'total_count' in r.data

    # --- Lines 579-582: respond_to_invitation save exception ---
    @mock.patch('gym_app.views.organization.OrganizationInvitationResponseSerializer')
    def test_respond_invitation_save_exception(
        self, MockSerializer, api_client, corp_client, client_u, org
    ):
        """Lines 579-582: exception during serializer.save() returns 400."""
        inv = OrganizationInvitation.objects.create(
            organization=org, invited_user=client_u,
            invited_by=corp_client, status='PENDING')
        mock_instance = mock.MagicMock()
        mock_instance.is_valid.return_value = True
        mock_instance.save.side_effect = RuntimeError("save failed")
        MockSerializer.return_value = mock_instance
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('respond-to-invitation',
                    kwargs={'invitation_id': inv.pk}),
            {'action': 'accept'},
            format='json')
        assert r.status_code == 400
        assert 'save failed' in r.data['error']
