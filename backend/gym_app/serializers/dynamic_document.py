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
            'signed', 'signed_at', 'created_at'
        ]
        read_only_fields = ['signed', 'signed_at', 'created_at']
    
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
    
    # Signature count fields
    completed_signatures = serializers.SerializerMethodField(read_only=True)
    total_signatures = serializers.SerializerMethodField(read_only=True)

    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)

    class Meta:
        model = DynamicDocument
        fields = [
            'id', 'title', 'content', 'state', 'created_by', 'assigned_to', 
            'created_at', 'updated_at', 'variables', 'requires_signature',
            'signatures', 'signers', 'signer_ids', 'fully_signed',
            'completed_signatures', 'total_signatures'
        ]

    def get_signer_ids(self, obj):
        """
        Return a list of IDs of the users who need to sign this document.
        This is used when editing an existing document to pre-populate 
        the signers selection.
        """
        return [signature.signer_id for signature in obj.signatures.all()]
        
    def get_completed_signatures(self, obj):
        """
        Return the number of completed signatures for this document.
        """
        if not obj.requires_signature:
            return 0
        return obj.signatures.filter(signed=True).count()
        
    def get_total_signatures(self, obj):
        """
        Return the total number of required signatures for this document.
        """
        if not obj.requires_signature:
            return 0
        return obj.signatures.count()

    def create(self, validated_data):
        """
        Create a new document with its variables and signatures.
        """
        # Extract signature-related data
        requires_signature = validated_data.pop('requires_signature', False)
        signers = validated_data.pop('signers', [])
        variables_data = validated_data.pop('variables', [])
        
        # Add _firma suffix to title if document requires signatures
        if requires_signature and not validated_data['title'].endswith('_firma'):
            validated_data['title'] = f"{validated_data['title']}_firma"

        # Get the creator from the request
        request = self.context.get('request')
        creator = request.user if request else None

        # Always set created_by to the current user if not explicitly provided
        if not validated_data.get('created_by') and creator:
            validated_data['created_by'] = creator

        # Create the document
        document = DynamicDocument.objects.create(
            **validated_data,
            requires_signature=requires_signature  # Explicitly set requires_signature
        )

        # Create variables
        variables = []
        for var_data in variables_data:
            variable = DocumentVariable.objects.create(document=document, **var_data)
            variables.append(variable)

        # Create signature records if required
        if requires_signature:
            # Create signature for the lawyer (document creator)
            if creator and creator.role == 'lawyer':
                try:
                    DocumentSignature.objects.create(
                        document=document,
                        signer=creator
                    )
                except Exception as e:
                    pass  # Handle error silently
            
            # Create signatures for clients
            for signer in signers:
                try:
                    DocumentSignature.objects.create(
                        document=document,
                        signer=signer
                    )
                except Exception as e:
                    pass  # Handle error silently

        return document

    def update(self, instance, validated_data):
        """
        Updates an existing DynamicDocument instance.

        Handles updating document variables, signature requirements, and main document fields.
        """
        # Extract variable data and signers
        variables_data = validated_data.pop('variables', [])
        signers = validated_data.pop('signers', [])
        requires_signature = validated_data.pop('requires_signature', instance.requires_signature)

        # Update variables if provided
        if variables_data:
            # Delete existing variables
            instance.variables.all().delete()
            # Create new variables
            for variable_data in variables_data:
                DocumentVariable.objects.create(document=instance, **variable_data)

        # Update signature requirements if needed
        if 'signers' in self.initial_data and requires_signature:
            # Get existing signers
            existing_signatures = {sig.signer.id: sig for sig in instance.signatures.all()}
            existing_signer_ids = set(existing_signatures.keys())
            new_signer_ids = set(signer.id for signer in signers)
            
            # Add new signers
            request = self.context.get('request')
            for signer in signers:
                if signer.id not in existing_signer_ids:
                    try:
                        DocumentSignature.objects.create(
                            document=instance,
                            signer=signer
                        )
                    except Exception as e:
                        pass  # Handle error silently

        # Update main document fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Set requires_signature explicitly
        instance.requires_signature = requires_signature
        instance.save()
        return instance


class RecentDocumentSerializer(serializers.ModelSerializer):
    document = DynamicDocumentSerializer(read_only=True)
    
    class Meta:
        model = RecentDocument
        fields = ['id', 'document', 'last_visited']
