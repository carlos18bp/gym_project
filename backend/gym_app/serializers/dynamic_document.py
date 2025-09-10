from rest_framework import serializers
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentVariable, RecentDocument, DocumentSignature, Tag, DocumentFolder,
    DocumentVisibilityPermission, DocumentUsabilityPermission, DocumentRelationship
)
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError
from gym_app.views.layouts.sendEmail import send_template_email

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
    
    # Permission fields for document creation
    visibility_user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=User.objects.all(),
        required=False,
        help_text="Users who can view this document"
    )
    
    usability_user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=User.objects.all(),
        required=False,
        help_text="Users who can use/edit this document"
    )
    
    # Read-only field to get the IDs of users who need to sign the document
    signer_ids = serializers.SerializerMethodField(read_only=True)
    
    # Signature count fields
    completed_signatures = serializers.SerializerMethodField(read_only=True)
    total_signatures = serializers.SerializerMethodField(read_only=True)
    
    # Permission fields for current user
    user_permission_level = serializers.SerializerMethodField(read_only=True)
    can_view = serializers.SerializerMethodField(read_only=True)
    can_edit = serializers.SerializerMethodField(read_only=True)
    can_delete = serializers.SerializerMethodField(read_only=True)

    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)

    class Meta:
        model = DynamicDocument
        fields = [
            'id', 'title', 'content', 'state', 'created_by', 'assigned_to', 
            'created_at', 'updated_at', 'variables', 'requires_signature',
            'signatures', 'signers', 'signer_ids', 'fully_signed',
            'completed_signatures', 'total_signatures', 'tags', 'tag_ids',
            'is_public', 'visibility_user_ids', 'usability_user_ids',
            'user_permission_level', 'can_view', 'can_edit', 'can_delete'
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
    

    
    def get_user_permission_level(self, obj):
        """
        Get the permission level for the current user on this document.
        """
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return None
        return obj.get_user_permission_level(request.user)
    
    def get_can_view(self, obj):
        """
        Check if the current user can view this document.
        """
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return False
        return obj.can_view(request.user)
    
    def get_can_edit(self, obj):
        """
        Check if the current user can edit this document.
        """
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return False
        
        user_permission = obj.get_user_permission_level(request.user)
        if not user_permission:
            return False
            
        # Define permission hierarchy (public_access and usability grant edit permissions)
        permission_hierarchy = ['view_only', 'public_access', 'usability', 'owner', 'lawyer']
        try:
            user_level = permission_hierarchy.index(user_permission)
            edit_level = permission_hierarchy.index('public_access')  # public_access allows editing
            return user_level >= edit_level
        except ValueError:
            return False
    
    def get_can_delete(self, obj):
        """
        Check if the current user can delete this document.
        """
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return False
        
        user_permission = obj.get_user_permission_level(request.user)
        if not user_permission:
            return False
            
        # Define permission hierarchy
        permission_hierarchy = ['view_only', 'public_access', 'usability', 'owner', 'lawyer']
        try:
            user_level = permission_hierarchy.index(user_permission)
            delete_level = permission_hierarchy.index('owner')  # Only owners and lawyers can delete
            return user_level >= delete_level
        except ValueError:
            return False

    def create(self, validated_data):
        """
        Create a new document with its variables, signatures, and permissions.
        """
        # Extract signature-related data
        requires_signature = validated_data.pop('requires_signature', False)
        signers = validated_data.pop('signers', [])
        variables_data = validated_data.pop('variables', [])
        tags = validated_data.pop('tags', [])  # Extract tags
        
        # Extract permission-related data
        visibility_user_ids = validated_data.pop('visibility_user_ids', [])
        usability_user_ids = validated_data.pop('usability_user_ids', [])
        
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

        # Create visibility permissions if provided and document is not public
        if visibility_user_ids and not document.is_public:
            from gym_app.models.dynamic_document import DocumentVisibilityPermission
            for user in visibility_user_ids:
                # Skip lawyers (they have automatic access)
                if user.role == 'lawyer' or user.is_gym_lawyer:
                    continue
                    
                try:
                    DocumentVisibilityPermission.objects.get_or_create(
                        document=document,
                        user=user,
                        defaults={'granted_by': creator}
                    )
                except Exception as e:
                    print(f"Error creating visibility permission for {user.email}: {e}")

        # Create usability permissions if provided
        if usability_user_ids:
            from gym_app.models.dynamic_document import DocumentUsabilityPermission
            for user in usability_user_ids:
                # Skip lawyers (they have automatic access)
                if user.role == 'lawyer' or user.is_gym_lawyer:
                    continue
                
                # Check if user has visibility permission (unless document is public)
                if not document.is_public:
                    has_visibility = user in visibility_user_ids or \
                                   document.visibility_permissions.filter(user=user).exists()
                    if not has_visibility:
                        print(f"Skipping usability permission for {user.email}: no visibility permission")
                        continue
                
                try:
                    DocumentUsabilityPermission.objects.get_or_create(
                        document=document,
                        user=user,
                        defaults={'granted_by': creator}
                    )
                except Exception as e:
                    print(f"Error creating usability permission for {user.email}: {e}")

        # # Send emails to signers if required
        # if requires_signature and signers:
        #     for signer in signers:
        #         try:
        #             send_template_email(
        #                 to_email=signer.email,
        #                 template_path='emails/signature_request.html',
        #                 context={
        #                     'signer_name': signer.first_name or signer.email,
        #                     'document_title': document.title,
        #                     'document_link': f'link_to_document/{document.id}/'
        #                 },
        #                 subject=f'Solicitud de firma para: {document.title}'
        #             )
        #         except Exception as e:
        #             # Log the error but don't fail the document creation
        #             print(f"Failed to send email to {signer.email}: {e}")

        return document

    def update(self, instance, validated_data):
        """
        Update an existing document with new variables, signatures, and permissions.
        """
        requires_signature = validated_data.pop('requires_signature', instance.requires_signature)
        signers = validated_data.pop('signers', [])
        variables_data = validated_data.pop('variables', None)
        tags = validated_data.pop('tags', None)  # Extract tags
        
        # Extract permission-related data
        visibility_user_ids = validated_data.pop('visibility_user_ids', None)
        usability_user_ids = validated_data.pop('usability_user_ids', None)

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

        # Update permissions if provided
        request = self.context.get('request')
        current_user = request.user if request else None
        
        # Update visibility permissions if provided
        if visibility_user_ids is not None:
            from gym_app.models.dynamic_document import DocumentVisibilityPermission
            
            # Remove existing visibility permissions (except for document creator)
            DocumentVisibilityPermission.objects.filter(
                document=instance
            ).exclude(user=instance.created_by).delete()
            
            # Add new visibility permissions if document is not public
            if not instance.is_public and visibility_user_ids:
                for user in visibility_user_ids:
                    # Skip lawyers (they have automatic access)
                    if user.role == 'lawyer' or user.is_gym_lawyer:
                        continue
                    
                    # Skip document creator (they always have access)
                    if user == instance.created_by:
                        continue
                        
                    try:
                        DocumentVisibilityPermission.objects.get_or_create(
                            document=instance,
                            user=user,
                            defaults={'granted_by': current_user}
                        )
                    except Exception as e:
                        print(f"Error updating visibility permission for {user.email}: {e}")

        # Update usability permissions if provided
        if usability_user_ids is not None:
            from gym_app.models.dynamic_document import DocumentUsabilityPermission
            
            # Remove existing usability permissions (except for document creator)
            DocumentUsabilityPermission.objects.filter(
                document=instance
            ).exclude(user=instance.created_by).delete()
            
            # Add new usability permissions
            if usability_user_ids:
                for user in usability_user_ids:
                    # Skip lawyers (they have automatic access)
                    if user.role == 'lawyer' or user.is_gym_lawyer:
                        continue
                    
                    # Skip document creator (they always have access)
                    if user == instance.created_by:
                        continue
                    
                    # Check if user has visibility permission (unless document is public)
                    if not instance.is_public:
                        has_visibility = (
                            visibility_user_ids and user in visibility_user_ids
                        ) or instance.visibility_permissions.filter(user=user).exists()
                        
                        if not has_visibility:
                            print(f"Skipping usability permission for {user.email}: no visibility permission")
                            continue
                    
                    try:
                        DocumentUsabilityPermission.objects.get_or_create(
                            document=instance,
                            user=user,
                            defaults={'granted_by': current_user}
                        )
                    except Exception as e:
                        print(f"Error updating usability permission for {user.email}: {e}")

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
        """Attach the current user (client) as folder owner."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['owner'] = request.user
        return super().create(validated_data)


class DocumentVisibilityPermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentVisibilityPermission model.
    
    Used to serialize visibility permissions granted to users for specific documents.
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.SerializerMethodField(read_only=True)
    granted_by_email = serializers.EmailField(source='granted_by.email', read_only=True)
    document_title = serializers.CharField(source='document.title', read_only=True)

    class Meta:
        model = DocumentVisibilityPermission
        fields = [
            'id', 'document', 'user', 'user_email', 'user_full_name',
            'granted_by', 'granted_by_email', 'granted_at', 'document_title'
        ]
        read_only_fields = ['id', 'granted_by', 'granted_at']

    def get_user_full_name(self, obj):
        """Return the full name of the user."""
        first_name = obj.user.first_name or ""
        last_name = obj.user.last_name or ""
        full_name = f"{first_name} {last_name}".strip()
        return full_name if full_name else obj.user.email


class DocumentRelationshipSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentRelationship model.
    
    Handles serialization/deserialization of document relationships with enhanced
    data for frontend consumption. Automatically includes document titles and
    creator information for display purposes.
    
    Features:
    - Auto-populated creator information from request context
    - Validation against self-relationships
    - Enhanced document metadata (titles, creator details)
    - Read-only fields for audit data
    
    Fields:
    - id: Unique identifier for the relationship
    - source_document: ID of the source document
    - target_document: ID of the target document  
    - created_by: User who created the relationship (auto-set)
    - created_at: Timestamp when relationship was created (auto-set)
    - source_document_title: Title of source document (read-only)
    - target_document_title: Title of target document (read-only)
    - created_by_email: Email of creator (read-only)
    - created_by_name: Full name of creator (read-only)
    """
    source_document_title = serializers.CharField(source='source_document.title', read_only=True)
    target_document_title = serializers.CharField(source='target_document.title', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DocumentRelationship
        fields = [
            'id', 'source_document', 'target_document', 'created_by', 'created_at',
            'source_document_title', 'target_document_title', 
            'created_by_email', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        """Return the full name of the user who created the relationship."""
        if obj.created_by:
            first_name = obj.created_by.first_name or ""
            last_name = obj.created_by.last_name or ""
            full_name = f"{first_name} {last_name}".strip()
            return full_name if full_name else obj.created_by.email
        return ""

    def validate(self, data):
        """
        Custom validation to ensure a document cannot be related to itself.
        """
        source_document = data.get('source_document')
        target_document = data.get('target_document')
        
        if source_document and target_document and source_document == target_document:
            raise serializers.ValidationError(
                "A document cannot be related to itself."
            )
        
        return data

    def create(self, validated_data):
        """
        Create a new document relationship.
        """
        # Set created_by from the request context
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        
        return super().create(validated_data)


class DocumentUsabilityPermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentUsabilityPermission model.
    
    Used to serialize usability permissions granted to users for specific documents.
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.SerializerMethodField(read_only=True)
    granted_by_email = serializers.EmailField(source='granted_by.email', read_only=True)
    document_title = serializers.CharField(source='document.title', read_only=True)


    class Meta:
        model = DocumentUsabilityPermission
        fields = [
            'id', 'document', 'user', 'user_email', 'user_full_name',
            'granted_by', 'granted_by_email', 'granted_at', 'document_title'
        ]
        read_only_fields = ['id', 'granted_by', 'granted_at']

    def get_user_full_name(self, obj):
        """Return the full name of the user."""
        first_name = obj.user.first_name or ""
        last_name = obj.user.last_name or ""
        full_name = f"{first_name} {last_name}".strip()
        return full_name if full_name else obj.user.email


class DocumentRelationshipSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentRelationship model.
    
    Handles serialization/deserialization of document relationships with enhanced
    data for frontend consumption. Automatically includes document titles and
    creator information for display purposes.
    
    Features:
    - Auto-populated creator information from request context
    - Validation against self-relationships
    - Enhanced document metadata (titles, creator details)
    - Read-only fields for audit data
    
    Fields:
    - id: Unique identifier for the relationship
    - source_document: ID of the source document
    - target_document: ID of the target document  
    - created_by: User who created the relationship (auto-set)
    - created_at: Timestamp when relationship was created (auto-set)
    - source_document_title: Title of source document (read-only)
    - target_document_title: Title of target document (read-only)
    - created_by_email: Email of creator (read-only)
    - created_by_name: Full name of creator (read-only)
    """
    source_document_title = serializers.CharField(source='source_document.title', read_only=True)
    target_document_title = serializers.CharField(source='target_document.title', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DocumentRelationship
        fields = [
            'id', 'source_document', 'target_document', 'created_by', 'created_at',
            'source_document_title', 'target_document_title', 
            'created_by_email', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        """Return the full name of the user who created the relationship."""
        if obj.created_by:
            first_name = obj.created_by.first_name or ""
            last_name = obj.created_by.last_name or ""
            full_name = f"{first_name} {last_name}".strip()
            return full_name if full_name else obj.created_by.email
        return ""

    def validate(self, data):
        """
        Custom validation to ensure a document cannot be related to itself.
        """
        source_document = data.get('source_document')
        target_document = data.get('target_document')
        
        if source_document and target_document and source_document == target_document:
            raise serializers.ValidationError(
                "A document cannot be related to itself."
            )
        
        return data

    def create(self, validated_data):
        """
        Create a new document relationship.
        """
        # Set created_by from the request context
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        
        return super().create(validated_data)
