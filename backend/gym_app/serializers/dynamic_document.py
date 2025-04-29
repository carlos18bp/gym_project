from rest_framework import serializers
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable, RecentDocument

User = get_user_model()


class DocumentVariableSerializer(serializers.ModelSerializer):
    """
    Serializer for the DocumentVariable model.

    This serializer handles the serialization and deserialization of document variables, 
    including their name in English and Spanish, tooltip, field type, and value.
    """
    id = serializers.IntegerField(required=False)

    class Meta:
        model = DocumentVariable
        fields = ['id', 'name_en', 'name_es', 'tooltip', 'field_type', 'value']


class DynamicDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer for the DynamicDocument model.

    This serializer manages the serialization and deserialization of dynamic documents.
    It includes related document variables and handles the creation and updating of documents.
    """
    # Relationship with document variables
    variables = DocumentVariableSerializer(many=True, required=False)

    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)

    class Meta:
        model = DynamicDocument
        fields = ['id', 'title', 'content', 'state', 'created_by', 'assigned_to', 'created_at', 'updated_at', 'variables']

    def create(self, validated_data):
        """
        Creates a new DynamicDocument instance.

        Extracts document variables from validated data, assigns the authenticated user as the creator,
        and creates the document along with its related variables.

        :param validated_data: Validated data containing document attributes and related variables.
        :return: Newly created DynamicDocument instance.
        """
        # Extract variable data
        variables_data = validated_data.pop('variables', [])

        # Automatically assign the authenticated user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user

        # Create the document
        document = DynamicDocument.objects.create(**validated_data)

        # Create related variables
        for variable_data in variables_data:
            DocumentVariable.objects.create(document=document, **variable_data)

        return document

    def update(self, instance, validated_data):
        """
        Updates an existing DynamicDocument instance.

        Updates document fields, manages related document variables (updates existing ones,
        creates new ones, and deletes omitted ones).

        :param instance: The DynamicDocument instance to be updated.
        :param validated_data: Validated data containing updated document attributes and related variables.
        :return: Updated DynamicDocument instance.
        """
        # Extract variables sent in the request
        variables_data = validated_data.pop('variables', [])
        
        # Only process variables if explicitly included in the update data
        # This prevents losing variables during partial updates
        should_update_variables = 'variables' in self.initial_data
        
        if should_update_variables:
            existing_variables = {var.id: var for var in instance.variables.all()}

            # Handle document variables
            for var_data in variables_data:
                if 'id' in var_data and var_data['id'] in existing_variables:
                    # Update existing variable
                    variable_instance = existing_variables.pop(var_data['id'])
                    for attr, value in var_data.items():
                        setattr(variable_instance, attr, value)
                    variable_instance.save()
                else:
                    # Create a new variable if it has no ID
                    DocumentVariable.objects.create(document=instance, **var_data)

            # Delete variables that were not included in the request
            for var_to_delete in existing_variables.values():
                var_to_delete.delete()

        # Update main document fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance


class RecentDocumentSerializer(serializers.ModelSerializer):
    document = DynamicDocumentSerializer(read_only=True)
    
    class Meta:
        model = RecentDocument
        fields = ['id', 'document', 'last_visited']
