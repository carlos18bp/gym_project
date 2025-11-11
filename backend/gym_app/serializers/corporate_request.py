from rest_framework import serializers
from gym_app.models import CorporateRequestType, CorporateRequestFiles, CorporateRequest, CorporateRequestResponse, User, Organization, OrganizationMembership

class CorporateRequestTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for the CorporateRequestType model.
    """
    class Meta:
        model = CorporateRequestType
        fields = '__all__'

class CorporateRequestFilesSerializer(serializers.ModelSerializer):
    """
    Serializer for the CorporateRequestFiles model.
    """
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()

    class Meta:
        model = CorporateRequestFiles
        fields = '__all__'

    def get_file_url(self, obj):
        """Get the full URL for the file"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_file_name(self, obj):
        """Get the original file name"""
        if obj.file:
            return obj.file.name.split('/')[-1]
        return None

    def get_file_size(self, obj):
        """Get the file size in bytes"""
        if obj.file:
            try:
                return obj.file.size
            except:
                return None
        return None

class CorporateRequestResponseSerializer(serializers.ModelSerializer):
    """
    Serializer for the CorporateRequestResponse model.
    """
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    response_files = CorporateRequestFilesSerializer(many=True, read_only=True)

    class Meta:
        model = CorporateRequestResponse
        fields = '__all__'
        read_only_fields = ['user', 'user_type']  # These fields are set automatically

    def get_user_name(self, obj):
        """Get the user's full name"""
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip()
        return None

    def create(self, validated_data):
        """
        Create a new corporate request response.
        """
        # Set the user from the request context
        request = self.context.get('request')
        if request and request.user:
            validated_data['user'] = request.user
            # Determine user type based on user role
            if request.user.role == 'corporate_client':
                validated_data['user_type'] = 'corporate_client'
            else:
                validated_data['user_type'] = 'client'
        
        return super().create(validated_data)

class UserBasicInfoSerializer(serializers.ModelSerializer):
    """
    Basic user information serializer for corporate requests.
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

class OrganizationBasicInfoSerializer(serializers.ModelSerializer):
    """
    Basic organization information serializer for corporate requests.
    """
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'title', 'profile_image', 'profile_image_url', 'cover_image']

    def get_profile_image_url(self, obj):
        """Get the full URL for the profile image"""
        if obj.profile_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            # If no request context, build URL with MEDIA_URL
            from django.conf import settings
            return f"{settings.MEDIA_URL}{obj.profile_image.name}"
        return None

class CorporateRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for the CorporateRequest model.
    """
    client_info = UserBasicInfoSerializer(source='client', read_only=True)
    corporate_client_info = UserBasicInfoSerializer(source='corporate_client', read_only=True)
    assigned_to_info = UserBasicInfoSerializer(source='assigned_to', read_only=True)
    organization_info = OrganizationBasicInfoSerializer(source='organization', read_only=True)
    request_type_name = serializers.CharField(source='request_type.name', read_only=True)
    files = CorporateRequestFilesSerializer(many=True, read_only=True)
    responses = CorporateRequestResponseSerializer(many=True, read_only=True)
    
    # Additional computed fields
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    days_since_created = serializers.SerializerMethodField()
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = CorporateRequest
        fields = '__all__'

    def get_days_since_created(self, obj):
        """Calculate days since the request was created"""
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        return delta.days

    def get_response_count(self, obj):
        """Get the number of responses for this request"""
        return obj.responses.count()

    def create(self, validated_data):
        """
        Create a new corporate request.
        """
        # Set the client from the request context (must be a normal client)
        request = self.context.get('request')
        if request and request.user:
            if request.user.role != 'client':
                raise serializers.ValidationError("Solo los clientes normales pueden crear solicitudes corporativas.")
            validated_data['client'] = request.user
            
            # Validate that client is member of the organization
            organization = validated_data.get('organization')
            if organization:
                is_member = OrganizationMembership.objects.filter(
                    organization=organization,
                    user=request.user,
                    is_active=True
                ).exists()
                if not is_member:
                    raise serializers.ValidationError("Debes ser miembro de la organización para crear solicitudes.")
        
        return super().create(validated_data)

    def validate_corporate_client(self, value):
        """
        Validate that the corporate_client is actually a corporate client.
        """
        if value.role != 'corporate_client':
            raise serializers.ValidationError("El destinatario debe ser un cliente corporativo.")
        return value

    def validate_assigned_to(self, value):
        """
        Validate that assigned_to user belongs to the corporate client organization (if specified).
        """
        if value and hasattr(self.instance, 'corporate_client'):
            # You might want to add additional validation here based on your business logic
            # For now, we'll just ensure it's not empty if provided
            pass
        return value

class CorporateRequestListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for listing corporate requests.
    """
    client_info = UserBasicInfoSerializer(source='client', read_only=True)
    corporate_client_email = serializers.CharField(source='corporate_client.email', read_only=True)
    corporate_client_name = serializers.SerializerMethodField()
    organization_info = OrganizationBasicInfoSerializer(source='organization', read_only=True)
    request_type_name = serializers.CharField(source='request_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    days_since_created = serializers.SerializerMethodField()
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = CorporateRequest
        fields = [
            'id', 'request_number', 'title', 'status', 'status_display',
            'priority', 'priority_display', 'created_at', 'status_updated_at',
            'client_info', 'corporate_client_email', 'corporate_client_name',
            'organization_info', 'request_type_name', 'days_since_created', 'response_count'
        ]

    def get_client_name(self, obj):
        return f"{obj.client.first_name} {obj.client.last_name}".strip()

    def get_corporate_client_name(self, obj):
        return f"{obj.corporate_client.first_name} {obj.corporate_client.last_name}".strip()

    def get_days_since_created(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        return delta.days

    def get_response_count(self, obj):
        return obj.responses.count()

class CorporateRequestCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating corporate requests (used by normal clients).
    """
    class Meta:
        model = CorporateRequest
        fields = [
            'organization', 'request_type', 'title', 'description', 
            'priority', 'files'
        ]

    def create(self, validated_data):
        """
        Create a new corporate request.
        """
        # Set the client from the request context
        request = self.context.get('request')
        if request and request.user:
            if request.user.role != 'client':
                raise serializers.ValidationError("Solo los clientes normales pueden crear solicitudes corporativas.")
            validated_data['client'] = request.user
            
            # Validate that client is member of the organization
            organization = validated_data.get('organization')
            if organization:
                is_member = OrganizationMembership.objects.filter(
                    organization=organization,
                    user=request.user,
                    is_active=True
                ).exists()
                if not is_member:
                    raise serializers.ValidationError("Debes ser miembro de la organización para crear solicitudes.")
        
        return super().create(validated_data)

class CorporateRequestUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating corporate requests (used by corporate clients).
    """
    class Meta:
        model = CorporateRequest
        fields = [
            'status', 'assigned_to', 'estimated_completion_date', 
            'actual_completion_date'
        ]

    def validate_assigned_to(self, value):
        """
        Validate that assigned_to user can be assigned to this request.
        """
        if value:
            # You can add business logic here to validate assignment
            # For example, ensure the user belongs to the corporate client's organization
            pass
        return value
