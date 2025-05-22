from rest_framework import serializers
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable, RecentDocument, DocumentSignature

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


class DocumentSignatureSerializer(serializers.ModelSerializer):
    """
    Serializer for the DocumentSignature model.
    
    This serializer handles the tracking of signatures for documents,
    including who needs to sign, signature status, and signature metadata.
    """
    signer_id = serializers.PrimaryKeyRelatedField(
        source='signer',
        queryset=User.objects.all(),
        write_only=True
    )
    signer_email = serializers.EmailField(source='signer.email', read_only=True)
    signer_name = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = DocumentSignature
        fields = [
            'id', 'signer_id', 'signer_email', 'signer_name',
            'signed', 'signed_at', 'signature_position'
        ]
        read_only_fields = ['signed', 'signed_at']
    
    def get_signer_name(self, obj):
        """Return the full name of the signer if available."""
        first_name = obj.signer.first_name or ""
        last_name = obj.signer.last_name or ""
        full_name = f"{first_name} {last_name}".strip()
        return full_name if full_name else obj.signer.email


class DynamicDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer for the DynamicDocument model.

    This serializer manages the serialization and deserialization of dynamic documents.
    It includes related document variables and handles the creation and updating of documents.
    """
    # Relationship with document variables
    variables = DocumentVariableSerializer(many=True, required=False)
    signatures = DocumentSignatureSerializer(many=True, required=False, read_only=True)
    
    # Users who need to sign this document - write only field for creating signature requests
    signers = serializers.PrimaryKeyRelatedField(
        many=True, 
        write_only=True, 
        queryset=User.objects.all(),
        required=False
    )
    
    # Read-only field to get the IDs of users who need to sign the document
    signer_ids = serializers.SerializerMethodField(read_only=True)

    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)

    class Meta:
        model = DynamicDocument
        fields = [
            'id', 'title', 'content', 'state', 'created_by', 'assigned_to', 
            'created_at', 'updated_at', 'variables', 'requires_signature',
            'signatures', 'signers', 'signer_ids', 'fully_signed'
        ]

    def get_signer_ids(self, obj):
        """
        Return a list of IDs of the users who need to sign this document.
        This is used when editing an existing document to pre-populate 
        the signers selection.
        """
        return [signature.signer_id for signature in obj.signatures.all()]

    def create(self, validated_data):
        """
        Creates a new DynamicDocument instance.

        Extracts document variables from validated data, assigns the authenticated user as the creator,
        and creates the document along with its related variables.

        :param validated_data: Validated data containing document attributes and related variables.
        :return: Newly created DynamicDocument instance.
        """
        # Extract variable data and signers
        variables_data = validated_data.pop('variables', [])
        signers = validated_data.pop('signers', [])

        # Automatically assign the authenticated user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user

        # Create the document
        document = DynamicDocument.objects.create(**validated_data)

        # Create related variables
        for variable_data in variables_data:
            DocumentVariable.objects.create(document=document, **variable_data)

        # Create signature requests if document requires signatures
        if document.requires_signature and signers:
            for position, signer in enumerate(signers):
                DocumentSignature.objects.create(
                    document=document,
                    signer=signer,
                    signature_position=position + 1  # Start position from 1
                )

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
        signers = validated_data.pop('signers', [])
        
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

        # Update signature requirements if needed
        if 'signers' in self.initial_data and instance.requires_signature:
            # Get existing signers
            existing_signatures = {sig.signer.id: sig for sig in instance.signatures.all()}
            existing_signer_ids = set(existing_signatures.keys())
            new_signer_ids = set(signer.id for signer in signers)
            
            # Add new signers
            for position, signer in enumerate(signers):
                if signer.id not in existing_signer_ids:
                    DocumentSignature.objects.create(
                        document=instance,
                        signer=signer,
                        signature_position=position + 1
                    )
                else:
                    # Update position of existing signers
                    sig = existing_signatures[signer.id]
                    sig.signature_position = position + 1
                    sig.save()
            
            # Remove signers not in the new list (only if they haven't signed yet)
            for signer_id in existing_signer_ids - new_signer_ids:
                sig = existing_signatures[signer_id]
                if not sig.signed:
                    sig.delete()

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
