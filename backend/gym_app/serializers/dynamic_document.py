from rest_framework import serializers
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable, RecentDocument, DocumentSignature, Tag, DocumentFolder
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError

User = get_user_model()


class DocumentVariableSerializer(serializers.ModelSerializer):
    """
    Serializer for the DocumentVariable model.

    This serializer handles the serialization and deserialization of document variables, 
    including their name in English and Spanish, tooltip, field type, and value.
    """
    id = serializers.IntegerField(required=False)
    select_options = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = DocumentVariable
        fields = ['id', 'name_en', 'name_es', 'tooltip', 'field_type', 'value', 'select_options']

    def validate(self, data):
        """
        Validate the data based on field type and requirements.
        """
        field_type = data.get('field_type')
        value = data.get('value')
        select_options = data.get('select_options')

        # Initialize select_options as empty array if field type is select and no options provided
        if field_type == 'select' and not select_options:
            data['select_options'] = []

        if value:
            if field_type == 'number':
                try:
                    float(value)
                except ValueError:
                    raise serializers.ValidationError({
                        'value': 'El valor debe ser un número válido.'
                    })
            elif field_type == 'date':
                try:
                    from datetime import datetime
                    datetime.strptime(value, '%Y-%m-%d')
                except ValueError:
                    raise serializers.ValidationError({
                        'value': 'El valor debe ser una fecha válida en formato YYYY-MM-DD.'
                    })
            elif field_type == 'email':
                validator = EmailValidator()
                try:
                    validator(value)
                except ValidationError:
                    raise serializers.ValidationError({
                        'value': 'El valor debe ser un correo electrónico válido.'
                    })

        # Validate select options if field type is select
        if field_type == 'select':
            if not select_options or not isinstance(select_options, list) or len(select_options) == 0:
                raise serializers.ValidationError({
                    'select_options': 'Debe proporcionar al menos una opción para el selector.'
                })

        return data


class TagSerializer(serializers.ModelSerializer):
    """Serializer for Tag model (lawyers only for mutations)."""
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color_id', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']

    def create(self, validated_data):
        """Attach the current user (lawyer) as tag creator."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)


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
    
    # Tags assigned to this document (read-only, nested serialization)
    tags = TagSerializer(many=True, read_only=True)
    
    # Write-only field for assigning tag IDs during creation/update
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=Tag.objects.all(),
        required=False,
        source='tags'
    )
    
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
            'completed_signatures', 'total_signatures', 'tags', 'tag_ids'
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
        tags = validated_data.pop('tags', [])  # Extract tags
        
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

        # Assign tags to the document
        if tags:
            document.tags.set(tags)

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
        tags = validated_data.pop('tags', None)  # Extract tags
        requires_signature = validated_data.pop('requires_signature', instance.requires_signature)

        # Update tags if provided
        if tags is not None:
            instance.tags.set(tags)

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


class DocumentFolderSerializer(serializers.ModelSerializer):
    """Serializer for DocumentFolder model (clients)."""
    document_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=DynamicDocument.objects.all(),
        write_only=True,
        required=False,
        source='documents'  # direct mapping
    )
    documents = DynamicDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentFolder
        fields = ['id', 'name', 'color_id', 'documents', 'document_ids', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        documents = validated_data.pop('documents', [])
        request = self.context.get('request')
        owner = request.user if request else None
        folder = DocumentFolder.objects.create(owner=owner, **validated_data)
        if documents:
            folder.documents.set(documents)
        return folder

    def update(self, instance, validated_data):
        # Handle documents update if provided
        documents = validated_data.pop('documents', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if documents is not None:
            instance.documents.set(documents)
        return instance
