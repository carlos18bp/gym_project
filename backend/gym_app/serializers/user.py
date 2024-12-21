from rest_framework import serializers
from gym_app.models.user import User

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