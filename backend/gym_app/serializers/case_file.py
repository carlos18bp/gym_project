from rest_framework import serializers
from gym_app.models import CaseFile

class CaseFileSerializer(serializers.ModelSerializer):
    """
    Serializer for the CaseFile model.
    Serializes all fields of the CaseFile model.
    """
    class Meta:
        model = CaseFile
        fields = '__all__'
