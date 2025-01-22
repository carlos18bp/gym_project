from rest_framework import serializers
from gym_app.models.dynamic_document import DynamicDocument

class DynamicDocumentSerializer(serializers.ModelSerializer):
    variables = serializers.JSONField()
    
    class Meta:
        model = DynamicDocument
        fields = '__all__'
