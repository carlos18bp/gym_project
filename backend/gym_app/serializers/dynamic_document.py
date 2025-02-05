from rest_framework import serializers
from gym_app.models.dynamic_document import DynamicDocument

class DynamicDocumentSerializer(serializers.ModelSerializer):
    variables_en = serializers.JSONField(required=False)  # Variables in English
    variables_es = serializers.JSONField(required=False)  # Variables in Spanish
    values = serializers.JSONField(required=False)  # Variable values
    field_type = serializers.ChoiceField(
        choices=DynamicDocument.FIELD_TYPE_CHOICES, 
        default='input'  # Default value set to 'input'
    )
    state = serializers.ChoiceField(
        choices=DynamicDocument.STATE_CHOICES, 
        default='Draft')  # Document state
    created_by = serializers.StringRelatedField(read_only=True)  # Display creator's string representation
    assigned_to = serializers.StringRelatedField(required=False)  # Display assigned user's string representation

    class Meta:
        model = DynamicDocument
        fields = '__all__'  # Include all fields from the model
