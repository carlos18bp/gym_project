from rest_framework import serializers
from gym_app.models import Stage

class StageSerializer(serializers.ModelSerializer):
    """
    Serializer for the Stage model.
    Serializes all fields of the Stage model.
    """
    class Meta:
        model = Stage
        fields = '__all__'
