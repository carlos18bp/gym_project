from rest_framework import serializers
from gym_app.models.intranet_gym import LegalLink

class LegalLinkSerializer(serializers.ModelSerializer):
    """
    Serializer for the LegalLink model.
    
    This serializer handles the serialization and deserialization of LegalLink objects,
    allowing them to be converted to and from JSON format.
    """
    class Meta:
        model = LegalLink
        fields = '__all__'
