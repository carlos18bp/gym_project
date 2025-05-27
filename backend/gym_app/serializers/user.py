from rest_framework import serializers
from gym_app.models.user import User, ActivityFeed, UserSignature

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.

    Attributes:
        model (User): The model that is being serialized.
        fields (list): List of fields to be included in the serialized output.
        extra_kwargs (dict): Dictionary specifying additional keyword arguments for certain fields.
    """
    class Meta:
        model = User  # The model that is being serialized
        fields = fields = '__all__'
        extra_kwargs = {'password': {'write_only': True}}  # Additional kwargs, setting 'password' as write-only


class UserSignatureSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserSignature model.
    
    This serializer handles the conversion of UserSignature model instances to/from JSON.
    
    Attributes:
        model (UserSignature): The model that is being serialized.
        fields (list): List of fields to be included in the serialized output.
    """
    class Meta:
        model = UserSignature
        fields = ['id', 'user', 'signature_image', 'method', 'created_at', 'ip_address']
        read_only_fields = ['created_at']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        if instance.signature_image and request:
            representation['signature_image'] = request.build_absolute_uri(instance.signature_image.url)
        return representation


class ActivityFeedSerializer(serializers.ModelSerializer):
    """
    Serializer for the ActivityFeed model.
    
    This serializer includes a human-readable timestamp and handles
    the conversion of action_type to its display value.
    
    Attributes:
        model (ActivityFeed): The model that is being serialized.
        fields (list): List of fields to be included in the serialized output.
    """
    # Include a human-readable timestamp
    time_ago = serializers.SerializerMethodField()
    # Get the display value for action_type
    action_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ActivityFeed
        fields = ['id', 'user', 'action_type', 'action_display', 'description', 'created_at', 'time_ago']
    
    def get_time_ago(self, obj):
        """
        Converts the created_at timestamp to a human-readable format (e.g., "2 hours ago").
        """
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.created_at, timezone.now())
    
    def get_action_display(self, obj):
        """
        Returns the display value for the action_type field.
        """
        return dict(ActivityFeed.ACTION_TYPE_CHOICES).get(obj.action_type, obj.action_type)