from rest_framework import serializers
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from gym_app.models import (
    Organization, OrganizationInvitation, OrganizationMembership, OrganizationPost,
    User
)

class UserBasicInfoSerializer(serializers.ModelSerializer):
    """
    Basic user information serializer for organization contexts.
    """
    full_name = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role', 'profile_image_url']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_profile_image_url(self, obj):
        """Get the full URL for the user's profile image"""
        if obj.photo_profile:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo_profile.url)
            # If no request context, build URL with MEDIA_URL
            from django.conf import settings
            return f"{settings.MEDIA_URL}{obj.photo_profile.name}"
        return None

class OrganizationListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for listing organizations.
    """
    corporate_client_info = UserBasicInfoSerializer(source='corporate_client', read_only=True)
    member_count = serializers.SerializerMethodField()
    pending_invitations_count = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'title', 'description', 'is_active', 'created_at', 'updated_at',
            'corporate_client_info', 'member_count', 'pending_invitations_count',
            'profile_image_url', 'cover_image_url'
        ]

    def get_member_count(self, obj):
        return obj.get_member_count()

    def get_pending_invitations_count(self, obj):
        return obj.get_pending_invitations_count()

    def get_profile_image_url(self, obj):
        """Get the full URL for the profile image"""
        if obj.profile_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None

    def get_cover_image_url(self, obj):
        """Get the full URL for the cover image"""
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None

class OrganizationSerializer(serializers.ModelSerializer):
    """
    Complete serializer for organization details.
    """
    corporate_client_info = UserBasicInfoSerializer(source='corporate_client', read_only=True)
    member_count = serializers.SerializerMethodField()
    pending_invitations_count = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    
    # Related data
    members = serializers.SerializerMethodField()
    recent_requests_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'title', 'description', 'is_active', 'created_at', 'updated_at',
            'corporate_client_info', 'member_count', 'pending_invitations_count',
            'profile_image_url', 'cover_image_url', 'members', 'recent_requests_count'
        ]

    def get_member_count(self, obj):
        return obj.get_member_count()

    def get_pending_invitations_count(self, obj):
        return obj.get_pending_invitations_count()

    def get_profile_image_url(self, obj):
        if obj.profile_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None

    def get_members(self, obj):
        """Get active members of the organization"""
        memberships = obj.memberships.filter(is_active=True).select_related('user')
        return [{
            'id': membership.user.id,
            'email': membership.user.email,
            'full_name': f"{membership.user.first_name} {membership.user.last_name}".strip(),
            'role': membership.role,
            'joined_at': membership.joined_at
        } for membership in memberships]

    def get_recent_requests_count(self, obj):
        """Get count of recent requests (last 30 days)"""
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        return obj.corporate_requests.filter(created_at__gte=thirty_days_ago).count()

class OrganizationCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating organizations.
    """
    class Meta:
        model = Organization
        fields = ['title', 'description', 'profile_image', 'cover_image']

    def validate(self, attrs):
        """Validate that only authenticated corporate clients can create organizations."""
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None

        if not user:
            raise serializers.ValidationError("Usuario no autenticado")

        if user.role != 'corporate_client':
            raise serializers.ValidationError("Solo los clientes corporativos pueden crear organizaciones")

        return attrs

    def create(self, validated_data):
        """Create organization with current user as corporate client.

        Assumes validation has already ensured an authenticated corporate_client user.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None

        if not user:
            raise serializers.ValidationError("Usuario no autenticado")

        validated_data['corporate_client'] = user
        organization = super().create(validated_data)

        # Create leadership membership for the corporate client
        OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role='LEADER',
        )

        return organization

class OrganizationUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating organizations.
    """
    class Meta:
        model = Organization
        fields = ['title', 'description', 'profile_image', 'cover_image', 'is_active']

class OrganizationMembershipSerializer(serializers.ModelSerializer):
    """
    Serializer for organization memberships.
    """
    user_info = UserBasicInfoSerializer(source='user', read_only=True)
    organization_title = serializers.CharField(source='organization.title', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            'id', 'role', 'role_display', 'joined_at', 'is_active', 
            'deactivated_at', 'user_info', 'organization_title'
        ]

class OrganizationInvitationSerializer(serializers.ModelSerializer):
    """
    Serializer for organization invitations.
    """
    organization_info = OrganizationListSerializer(source='organization', read_only=True)
    invited_by_info = UserBasicInfoSerializer(source='invited_by', read_only=True)
    invited_user_info = UserBasicInfoSerializer(source='invited_user', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_expired = serializers.SerializerMethodField()
    can_be_responded = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationInvitation
        fields = [
            'id', 'message', 'status', 'status_display', 'created_at', 
            'expires_at', 'responded_at', 'organization_info', 'invited_by_info', 
            'invited_user_info', 'is_expired', 'can_be_responded'
        ]

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_can_be_responded(self, obj):
        return obj.can_be_responded()

class OrganizationInvitationCreateSerializer(serializers.Serializer):
    """
    Serializer for creating organization invitations.
    """
    invited_user_email = serializers.EmailField()
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate_invited_user_email(self, value):
        """Validate that the email corresponds to a normal client or basic user"""
        try:
            user = User.objects.get(email=value, role__in=['client', 'basic'])
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("No se encontró un cliente normal o usuario básico con este email")

    def validate(self, attrs):
        """Additional validation for membership and pending invitations.

        Ensures that the invited user is not already an active member and does not
        have a pending invitation for the same organization.
        """
        organization = self.context['organization']
        invited_email = attrs.get('invited_user_email')

        # We already validated that the user exists and has an allowed role
        invited_user = User.objects.get(
            email=invited_email,
            role__in=['client', 'basic'],
        )

        # Check if user is already a member
        existing_membership = OrganizationMembership.objects.filter(
            organization=organization,
            user=invited_user,
            is_active=True,
        ).exists()

        if existing_membership:
            raise serializers.ValidationError("El usuario ya es miembro de esta organización")

        # Check for existing pending invitation
        existing_invitation = OrganizationInvitation.objects.filter(
            organization=organization,
            invited_user=invited_user,
            status='PENDING',
        ).exists()

        if existing_invitation:
            raise serializers.ValidationError("Ya existe una invitación pendiente para este usuario")

        # Cache invited_user for use in create()
        self._invited_user = invited_user

        return attrs

    def create(self, validated_data):
        """Create invitation for the specified organization"""
        organization = self.context['organization']
        request = self.context['request']
        
        # Use invited_user computed during validation when available
        invited_user = getattr(self, '_invited_user', None)
        if invited_user is None:
            invited_user = User.objects.get(
                email=validated_data['invited_user_email'],
                role__in=['client', 'basic'],
            )

        # Create invitation
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=invited_user,
            invited_by=request.user,
            message=validated_data.get('message', '')
        )
        
        return invitation

class OrganizationInvitationResponseSerializer(serializers.Serializer):
    """
    Serializer for responding to organization invitations.
    """
    action = serializers.ChoiceField(choices=['accept', 'reject'])

    def update(self, instance, validated_data):
        """Accept or reject the invitation"""
        action = validated_data['action']
        
        try:
            if action == 'accept':
                instance.accept()
            elif action == 'reject':
                instance.reject()
        except DjangoValidationError as e:
            raise serializers.ValidationError(str(e))
        
        return instance

class OrganizationStatsSerializer(serializers.Serializer):
    """
    Serializer for organization statistics.
    """
    total_organizations = serializers.IntegerField()
    total_members = serializers.IntegerField()
    total_pending_invitations = serializers.IntegerField()
    recent_requests_count = serializers.IntegerField()
    active_organizations_count = serializers.IntegerField()
    
    # Organization breakdown
    organizations_by_status = serializers.DictField()
    recent_invitations_count = serializers.IntegerField()

class OrganizationSearchSerializer(serializers.Serializer):
    """
    Serializer for organization search parameters.
    """
    search = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    created_after = serializers.DateTimeField(required=False)
    created_before = serializers.DateTimeField(required=False)
    min_members = serializers.IntegerField(required=False, min_value=0)
    max_members = serializers.IntegerField(required=False, min_value=0)


# ========================================
# Organization Post Serializers
# ========================================

class OrganizationPostSerializer(serializers.ModelSerializer):
    """
    Serializer for OrganizationPost model.
    """
    author_info = UserBasicInfoSerializer(source='author', read_only=True)
    organization_title = serializers.CharField(source='organization.title', read_only=True)
    has_link = serializers.ReadOnlyField()
    
    class Meta:
        model = OrganizationPost
        fields = [
            'id', 'title', 'content', 'link_name', 'link_url', 
            'organization', 'author', 'author_info', 'organization_title',
            'is_active', 'is_pinned', 'has_link', 'created_at', 'updated_at'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']

    def create(self, validated_data):
        """Auto-assign author from request user"""
        request = self.context.get('request')
        if request and request.user:
            if request.user.role != 'corporate_client':
                raise serializers.ValidationError("Solo los clientes corporativos pueden crear posts")
            validated_data['author'] = request.user
        return super().create(validated_data)

    def validate(self, data):
        """Validate organization post data"""
        # Ensure both link fields are provided together or not at all
        link_name = data.get('link_name')
        link_url = data.get('link_url')
        
        if link_name and not link_url:
            raise serializers.ValidationError(
                "Si se proporciona un nombre de enlace, también debe proporcionar la URL"
            )
        
        if link_url and not link_name:
            raise serializers.ValidationError(
                "Si se proporciona una URL, también debe proporcionar un nombre para el enlace"
            )
        
        # Validate that user is leader of the organization
        request = self.context.get('request')
        organization = data.get('organization')
        if request and request.user and organization:
            if organization.corporate_client != request.user:
                raise serializers.ValidationError(
                    "Solo el líder de la organización puede crear posts"
                )
        
        return data


class OrganizationPostListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for listing organization posts.
    """
    author_name = serializers.SerializerMethodField()
    has_link = serializers.ReadOnlyField()
    
    class Meta:
        model = OrganizationPost
        fields = [
            'id', 'title', 'content', 'link_name', 'link_url',
            'author_name', 'is_active', 'is_pinned', 'has_link', 
            'created_at', 'updated_at'
        ]
    
    def get_author_name(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}".strip()


class OrganizationPostCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating organization posts.
    """
    class Meta:
        model = OrganizationPost
        fields = [
            'title', 'content', 'link_name', 'link_url', 
            'organization', 'is_pinned'
        ]

    def create(self, validated_data):
        """Auto-assign author from request user"""
        request = self.context.get('request')
        if request and request.user:
            if request.user.role != 'corporate_client':
                raise serializers.ValidationError("Solo los clientes corporativos pueden crear posts")
            validated_data['author'] = request.user
        return super().create(validated_data)

    def validate(self, data):
        """Validate post creation data"""
        # Ensure both link fields are provided together or not at all
        link_name = data.get('link_name')
        link_url = data.get('link_url')
        
        if link_name and not link_url:
            raise serializers.ValidationError({
                'link_url': ["Si se proporciona un nombre de enlace, también debe proporcionar la URL"]
            })
        
        if link_url and not link_name:
            raise serializers.ValidationError({
                'link_name': ["Si se proporciona una URL, también debe proporcionar un nombre para el enlace"]
            })
        
        # Validate that user is leader of the organization
        request = self.context.get('request')
        organization = data.get('organization')
        if request and request.user and organization:
            if organization.corporate_client != request.user:
                raise serializers.ValidationError(
                    "Solo el líder de la organización puede crear posts"
                )
        
        return data


class OrganizationPostUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating organization posts.
    """
    class Meta:
        model = OrganizationPost
        fields = [
            'title', 'content', 'link_name', 'link_url', 
            'is_active', 'is_pinned'
        ]

    def validate(self, data):
        """Validate post update data"""
        # Ensure both link fields are provided together or not at all
        link_name = data.get('link_name')
        link_url = data.get('link_url')
        
        if link_name and not link_url:
            raise serializers.ValidationError({
                'link_url': ["Si se proporciona un nombre de enlace, también debe proporcionar la URL"]
            })
        
        if link_url and not link_name:
            raise serializers.ValidationError({
                'link_name': ["Si se proporciona una URL, también debe proporcionar un nombre para el enlace"]
            })
        
        return data
