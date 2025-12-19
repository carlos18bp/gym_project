from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from gym_app.models import User, Process, Stage, CaseFile, Case, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequestResponse, CorporateRequest, CorporateRequestType, CorporateRequestFiles, CorporateRequestResponse, Organization, OrganizationInvitation, OrganizationMembership, OrganizationPost, LegalDocument, IntranetProfile, DynamicDocument, DocumentVariable, LegalUpdate, RecentDocument, RecentProcess, DocumentSignature, Tag, DocumentVisibilityPermission, DocumentUsabilityPermission, DocumentFolder, DocumentRelationship, Subscription, PaymentHistory
from gym_app.models.user import UserSignature

class UserAdmin(BaseUserAdmin):
    """
    Custom admin configuration for the User model.
    Displays and manages user information in the admin interface.
    Extends BaseUserAdmin to properly handle password hashing.
    """
    list_display = (
        'email', 'first_name', 'last_name', 'document_type', 'identification',
        'role', 'is_staff', 'is_active', 'created_at'
    )
    search_fields = ('first_name', 'last_name', 'email', 'identification', 'role', 'document_type')
    list_filter = ('role', 'document_type', 'is_staff', 'is_active', 'created_at')
    ordering = ('email',)
    filter_horizontal = ()
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {
            'fields': ('first_name', 'last_name', 'contact', 'birthday', 
                      'identification', 'document_type', 'photo_profile', 'letterhead_image')
        }),
        (_('Permissions'), {
            'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 
                      'is_gym_lawyer', 'is_profile_completed'),
        }),
        (_('Important dates'), {
            'fields': ('last_login', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
        (_('Personal info'), {
            'fields': ('first_name', 'last_name', 'contact', 'birthday', 
                      'identification', 'document_type')
        }),
        (_('Permissions'), {
            'fields': ('role', 'is_active', 'is_staff', 'is_superuser'),
        }),
    )
    
    readonly_fields = ('last_login', 'created_at')

class UserSignatureAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the UserSignature model.
    Manages user signatures and their associated metadata.
    """
    list_display = ('user', 'method', 'created_at', 'ip_address')
    search_fields = ('user__email', 'method', 'ip_address')
    list_filter = ('method', 'created_at')
    readonly_fields = ('created_at', 'ip_address')

class LegalDocumentAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalDocument model.
    Manages legal documents and their metadata.
    """
    list_display = ('name', 'file')
    search_fields = ('name',)
    list_filter = ('name',)

class IntranetProfileAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the IntranetProfile model.
    Manages cover and profile images for the intranet documents section.
    """
    list_display = ('id', 'cover_image', 'profile_image', 'created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Images', {
            'fields': ('cover_image', 'profile_image')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

class ProcessAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Process model.
    Provides comprehensive management of legal processes.
    """
    list_display = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'get_primary_client', 'lawyer', 'case', 'subcase', 'created_at'
    )
    filter_horizontal = ('stages', 'case_files')
    search_fields = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'clients__email', 'lawyer__email', 'case__type', 'subcase', 'created_at'
    )
    list_filter = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'clients', 'lawyer', 'case', 'subcase', 'created_at'
    )

    def get_primary_client(self, obj):
        clients_qs = obj.clients.all()
        client = clients_qs.first()
        if not client:
            return None
        full_name = f"{client.first_name} {client.last_name}".strip()
        return f"{full_name} ({client.email})" if client.email else full_name
    get_primary_client.short_description = 'Cliente'

class CaseAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Case model.
    Manages case types and their metadata.
    """
    list_display = ('type',)
    search_fields = ('type',)
    list_filter = ('type',)

class LegalRequestAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequest model.
    Manages legal requests and their associated data.
    """
    list_display = (
        'request_number', 'get_user_name', 'get_user_email', 'request_type', 
        'discipline', 'status', 'created_at'
    )
    filter_horizontal = ('files',)
    search_fields = (
        'request_number', 'user__first_name', 'user__last_name', 'user__email', 
        'request_type__name', 'discipline__name', 'description'
    )
    list_filter = (
        'status', 'request_type', 'discipline', 'created_at'
    )
    readonly_fields = ('request_number', 'created_at', 'status_updated_at')
    
    def get_user_name(self, obj):
        """Get the full name of the user who created the request."""
        return f"{obj.user.first_name} {obj.user.last_name}".strip()
    get_user_name.short_description = 'Usuario'
    get_user_name.admin_order_field = 'user__first_name'
    
    def get_user_email(self, obj):
        """Get the email of the user who created the request."""
        return obj.user.email
    get_user_email.short_description = 'Email'
    get_user_email.admin_order_field = 'user__email'

class LegalRequestTypeAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestType model.
    Manages types of legal requests.
    """
    list_display = ('name',)
    search_fields = ('name',)
    list_filter = ('name',)

class LegalDisciplineAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalDiscipline model.
    Manages legal disciplines and their metadata.
    """
    list_display = ('name',)
    search_fields = ('name',)
    list_filter = ('name',)

class LegalRequestFilesAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestFiles model.
    Manages files associated with legal requests.
    """
    list_display = ('file', 'created_at')
    search_fields = ('file',)
    list_filter = ('created_at',)

class LegalRequestResponseAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestResponse model.
    Manages responses to legal requests.
    """
    list_display = ('legal_request', 'get_user_name', 'user_type', 'get_response_preview', 'created_at')
    list_filter = ('user_type', 'created_at')
    search_fields = ('legal_request__request_number', 'user__first_name', 'user__last_name', 'response_text')
    readonly_fields = ('created_at',)
    raw_id_fields = ('legal_request', 'user')
    
    def get_user_name(self, obj):
        """Get the full name of the user who created the response."""
        return f"{obj.user.first_name} {obj.user.last_name}".strip()
    get_user_name.short_description = 'Usuario'
    get_user_name.admin_order_field = 'user__first_name'
    
    def get_response_preview(self, obj):
        """Get a preview of the response text."""
        return obj.response_text[:100] + '...' if len(obj.response_text) > 100 else obj.response_text
    get_response_preview.short_description = 'Respuesta'

class CorporateRequestAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the CorporateRequest model.
    """
    list_display = (
        'request_number', 'title', 'get_client_name', 'get_corporate_client_name', 
        'status', 'priority', 'created_at', 'get_assigned_to_name'
    )
    search_fields = (
        'request_number', 'title', 'description',
        'client__email', 'client__first_name', 'client__last_name',
        'corporate_client__email', 'corporate_client__first_name', 'corporate_client__last_name'
    )
    list_filter = ('status', 'priority', 'request_type', 'created_at', 'status_updated_at')
    readonly_fields = ('request_number', 'created_at', 'status_updated_at')
    filter_horizontal = ('files',)
    raw_id_fields = ('client', 'corporate_client', 'assigned_to')
    
    def get_client_name(self, obj):
        return f"{obj.client.first_name} {obj.client.last_name} ({obj.client.email})" if obj.client else None
    get_client_name.short_description = 'Cliente'
    get_client_name.admin_order_field = 'client__email'
    
    def get_corporate_client_name(self, obj):
        return f"{obj.corporate_client.first_name} {obj.corporate_client.last_name} ({obj.corporate_client.email})" if obj.corporate_client else None
    get_corporate_client_name.short_description = 'Cliente Corporativo'
    get_corporate_client_name.admin_order_field = 'corporate_client__email'
    
    def get_assigned_to_name(self, obj):
        return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}" if obj.assigned_to else "No asignado"
    get_assigned_to_name.short_description = 'Asignado a'
    get_assigned_to_name.admin_order_field = 'assigned_to__email'

class CorporateRequestTypeAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the CorporateRequestType model.
    """
    list_display = ('name',)
    search_fields = ('name',)
    list_filter = ('name',)

class CorporateRequestFilesAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the CorporateRequestFiles model.
    """
    list_display = ('file', 'created_at')
    search_fields = ('file',)
    list_filter = ('created_at',)
    readonly_fields = ('created_at',)

class CorporateRequestResponseAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the CorporateRequestResponse model.
    """
    list_display = (
        'corporate_request', 'get_user_name', 'user_type', 
        'is_internal_note', 'get_response_preview', 'created_at'
    )
    search_fields = (
        'corporate_request__request_number', 'user__email', 
        'response_text'
    )
    list_filter = ('user_type', 'is_internal_note', 'created_at')
    readonly_fields = ('created_at',)
    filter_horizontal = ('response_files',)
    raw_id_fields = ('corporate_request', 'user')
    
    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else None
    get_user_name.short_description = 'Usuario'
    get_user_name.admin_order_field = 'user__email'
    
    def get_response_preview(self, obj):
        """Display a preview of the response text"""
        return obj.response_text[:100] + "..." if len(obj.response_text) > 100 else obj.response_text
    get_response_preview.short_description = "Vista Previa"

class OrganizationAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Organization model.
    """
    list_display = (
        'title', 'get_corporate_client_name', 'is_active', 
        'get_member_count', 'get_pending_invitations_count', 'created_at'
    )
    search_fields = (
        'title', 'description',
        'corporate_client__email', 'corporate_client__first_name', 'corporate_client__last_name'
    )
    list_filter = ('is_active', 'created_at')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('corporate_client',)
    
    def get_corporate_client_name(self, obj):
        return f"{obj.corporate_client.first_name} {obj.corporate_client.last_name} ({obj.corporate_client.email})"
    get_corporate_client_name.short_description = 'Líder Corporativo'
    get_corporate_client_name.admin_order_field = 'corporate_client__email'
    
    def get_member_count(self, obj):
        return obj.get_member_count()
    get_member_count.short_description = 'Miembros'
    
    def get_pending_invitations_count(self, obj):
        return obj.get_pending_invitations_count()
    get_pending_invitations_count.short_description = 'Invitaciones Pendientes'

class OrganizationInvitationAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the OrganizationInvitation model.
    """
    list_display = (
        'organization', 'get_invited_user_name', 'get_invited_by_name',
        'status', 'created_at', 'expires_at', 'get_is_expired'
    )
    search_fields = (
        'organization__title',
        'invited_user__email', 'invited_user__first_name', 'invited_user__last_name',
        'invited_by__email', 'invited_by__first_name', 'invited_by__last_name'
    )
    list_filter = ('status', 'created_at', 'expires_at')
    readonly_fields = ('invitation_token', 'created_at', 'responded_at')
    raw_id_fields = ('organization', 'invited_user', 'invited_by')
    
    def get_invited_user_name(self, obj):
        return f"{obj.invited_user.first_name} {obj.invited_user.last_name} ({obj.invited_user.email})"
    get_invited_user_name.short_description = 'Usuario Invitado'
    get_invited_user_name.admin_order_field = 'invited_user__email'
    
    def get_invited_by_name(self, obj):
        return f"{obj.invited_by.first_name} {obj.invited_by.last_name} ({obj.invited_by.email})"
    get_invited_by_name.short_description = 'Invitado Por'
    get_invited_by_name.admin_order_field = 'invited_by__email'
    
    def get_is_expired(self, obj):
        return obj.is_expired()
    get_is_expired.short_description = 'Expirada'
    get_is_expired.boolean = True

class OrganizationMembershipAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the OrganizationMembership model.
    """
    list_display = (
        'organization', 'get_user_name', 'role', 'is_active', 
        'joined_at', 'deactivated_at'
    )
    search_fields = (
        'organization__title',
        'user__email', 'user__first_name', 'user__last_name'
    )
    list_filter = ('role', 'is_active', 'joined_at')
    readonly_fields = ('joined_at',)
    raw_id_fields = ('organization', 'user')
    
    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name} ({obj.user.email})"
    get_user_name.short_description = 'Usuario'
    get_user_name.admin_order_field = 'user__email'


class OrganizationPostAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the OrganizationPost model.
    """
    list_display = (
        'title', 'organization', 'get_author_name', 'is_active', 
        'is_pinned', 'has_link', 'created_at'
    )
    search_fields = (
        'title', 'content', 'link_name',
        'organization__title',
        'author__email', 'author__first_name', 'author__last_name'
    )
    list_filter = ('is_active', 'is_pinned', 'created_at')
    readonly_fields = ('created_at', 'updated_at', 'has_link')
    raw_id_fields = ('organization', 'author')
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('title', 'content', 'organization', 'author')
        }),
        ('Hipervínculo (Opcional)', {
            'fields': ('link_name', 'link_url'),
            'classes': ('collapse',)
        }),
        ('Estado y Visibilidad', {
            'fields': ('is_active', 'is_pinned')
        }),
        ('Información de Sistema', {
            'fields': ('created_at', 'updated_at', 'has_link'),
            'classes': ('collapse',)
        }),
    )
    
    def get_author_name(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name} ({obj.author.email})"
    get_author_name.short_description = 'Autor'
    get_author_name.admin_order_field = 'author__email'
    
    def has_link(self, obj):
        return obj.has_link
    has_link.short_description = 'Tiene Enlace'
    has_link.boolean = True

class DocumentVariableInline(admin.StackedInline):
    """
    Inline configuration for managing document variables within the DynamicDocument admin.
    Allows adding and editing variables directly in the document form.
    """
    model = DocumentVariable
    extra = 1
    verbose_name = "Variable"
    verbose_name_plural = "Variables"

class DynamicDocumentAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the DynamicDocument model.
    Provides comprehensive management of dynamic documents with variable support.
    """
    list_display = ('title', 'state', 'created_by', 'assigned_to', 'is_public', 'fully_signed', 'requires_signature', 'created_at')
    search_fields = ('title', 'content', 'created_by__email', 'assigned_to__email', 'tags__name')
    list_filter = ('state', 'is_public', 'requires_signature', 'fully_signed', 'created_at', 'updated_at', 'tags')
    filter_horizontal = ('tags',)
    inlines = [DocumentVariableInline]

    fieldsets = (
        ('Document Information', {
            'fields': ('title', 'content', 'state', 'letterhead_image')
        }),
        ('Access Control', {
            'fields': ('is_public', 'created_by', 'assigned_to'),
            'description': 'Control document visibility and ownership. When is_public=True, all users can view and use this document as a template.'
        }),
        ('Tags & Organization', {
            'fields': ('tags',),
            'description': 'Organize documents with tags for better filtering and categorization.'
        }),
        ('Signature Management', {
            'fields': ('requires_signature', 'fully_signed'),
            'description': 'Manage document signature requirements and status.'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at', 'fully_signed')
    
    def get_queryset(self, request):
        """Optimize queryset to reduce database queries."""
        return super().get_queryset(request).select_related('created_by', 'assigned_to').prefetch_related('tags')

class LegalUpdateAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalUpdate model.
    Manages legal updates and notifications.
    """
    list_display = ('title', 'content', 'link_text', 'link_url', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('title', 'content', 'link_text')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('title', 'content', 'image', 'link_text', 'link_url', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    class Meta:
        verbose_name = 'Legal Update'
        verbose_name_plural = 'Legal Updates'

class RecentDocumentAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the RecentDocument model.
    Manages recently accessed documents.
    """
    list_display = ('user', 'document', 'last_visited')
    list_filter = ('last_visited', 'user')
    search_fields = ('user__email', 'document__title')
    readonly_fields = ('last_visited',)

class RecentProcessAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the RecentProcess model.
    Manages recently accessed processes.
    """
    list_display = ('user', 'process', 'last_viewed')
    list_filter = ('last_viewed', 'user')
    search_fields = ('user__email', 'process__ref')
    readonly_fields = ('last_viewed',)

@admin.register(DocumentSignature)
class DocumentSignatureAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the DocumentSignature model.
    Manages document signatures and their metadata.
    """
    list_display = ['document', 'signer', 'signed', 'signed_at']
    list_filter = ['signed', 'signed_at']
    search_fields = ['document__title', 'signer__email', 'signer__first_name', 'signer__last_name']
    ordering = ['signed_at']

class TagAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Tag model.
    Manages document tags for categorization and filtering.
    """
    list_display = ('name', 'color_id', 'get_document_count')
    search_fields = ('name',)
    list_filter = ('color_id',)
    ordering = ('name',)
    
    def get_document_count(self, obj):
        """Get the count of documents using this tag."""
        return obj.documents.count()
    get_document_count.short_description = 'Documents Count'
    get_document_count.admin_order_field = 'documents__count'

class DocumentVisibilityPermissionAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for DocumentVisibilityPermission model.
    Manages who can view specific documents.
    """
    list_display = ('document', 'user', 'granted_at')
    search_fields = ('document__title', 'user__email', 'user__first_name', 'user__last_name')
    list_filter = ('granted_at',)
    raw_id_fields = ('document', 'user')
    readonly_fields = ('granted_at',)

class DocumentUsabilityPermissionAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for DocumentUsabilityPermission model.
    Manages who can edit/use specific documents.
    """
    list_display = ('document', 'user', 'granted_at')
    search_fields = ('document__title', 'user__email', 'user__first_name', 'user__last_name')
    list_filter = ('granted_at',)
    raw_id_fields = ('document', 'user')
    readonly_fields = ('granted_at',)

class DocumentFolderAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for DocumentFolder model.
    Manages document folders and organization.
    """
    list_display = ('name', 'color_id', 'get_document_count', 'created_at')
    search_fields = ('name',)
    list_filter = ('color_id', 'created_at')
    filter_horizontal = ('documents',)
    readonly_fields = ('created_at',)
    
    def get_document_count(self, obj):
        """Get the count of documents in this folder."""
        return obj.documents.count()
    get_document_count.short_description = 'Documents Count'
    get_document_count.admin_order_field = 'documents__count'

class DocumentRelationshipAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for DocumentRelationship model.
    Manages relationships between documents.
    """
    list_display = ('source_document', 'target_document', 'created_by', 'created_at')
    search_fields = ('source_document__title', 'target_document__title')
    list_filter = ('created_at', 'created_by')
    raw_id_fields = ('source_document', 'target_document', 'created_by')
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Relationship Details', {
            'fields': ('source_document', 'target_document', 'created_by')
        }),
        ('Additional Information', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

class GyMAdminSite(admin.AdminSite):
    """
    Custom AdminSite to organize models by functional sections.
    Provides a structured and intuitive admin interface.
    """
    site_header = 'G&M App Administration'
    site_title = 'G&M Admin'
    index_title = 'Welcome to G&M App Control Panel'

    def get_app_list(self, request):
        app_dict = self._build_app_dict(request)
        # Custom structure for the admin index
        custom_app_list = [
            {
                'name': _('Dashboard'),
                'app_label': 'dashboard',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['LegalUpdate']
                ]
            },
            {
                'name': _('User Management'),
                'app_label': 'user_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['User', 'UserSignature']
                ]
            },
            {
                'name': _('Intranet Documents Management'),
                'app_label': 'legal_user_link_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['LegalDocument', 'IntranetProfile']
                ]
            },
            {
                'name': _('Process Management'),
                'app_label': 'process_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['Process', 'Case']
                ]
            },
            {
                'name': _('Legal Request Management'),
                'app_label': 'legal_request_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['LegalRequest', 'LegalRequestType', 'LegalDiscipline', 'LegalRequestFiles', 'LegalRequestResponse']
                ]
            },
            {
                'name': _('Corporate Request Management'),
                'app_label': 'corporate_request_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['CorporateRequest', 'CorporateRequestType', 'CorporateRequestFiles', 'CorporateRequestResponse']
                ]
            },
            {
                'name': _('Organization Management'),
                'app_label': 'organization_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['Organization', 'OrganizationInvitation', 'OrganizationMembership', 'OrganizationPost']
                ]
            },
            {
                'name': _('Dynamic Document Generate'),
                'app_label': 'dynamic_document',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in [
                        'DynamicDocument', 'DocumentSignature', 'DocumentVariable', 
                        'Tag', 'DocumentFolder', 'DocumentVisibilityPermission', 
                        'DocumentUsabilityPermission', 'DocumentRelationship'
                    ]
                ]
            },
        ]
        return custom_app_list

# Create an instance of the custom AdminSite
admin_site = GyMAdminSite(name='myadmin')

# Register models with the custom AdminSite
admin_site.register(User, UserAdmin)
admin_site.register(UserSignature, UserSignatureAdmin)
admin_site.register(Process, ProcessAdmin)
admin_site.register(Case, CaseAdmin)
admin_site.register(Stage)
admin_site.register(CaseFile)
admin_site.register(LegalRequest, LegalRequestAdmin)
admin_site.register(LegalRequestType, LegalRequestTypeAdmin)
admin_site.register(LegalDiscipline, LegalDisciplineAdmin)
admin_site.register(LegalRequestFiles, LegalRequestFilesAdmin)
admin_site.register(LegalRequestResponse, LegalRequestResponseAdmin)
admin_site.register(CorporateRequest, CorporateRequestAdmin)
admin_site.register(CorporateRequestType, CorporateRequestTypeAdmin)
admin_site.register(CorporateRequestFiles, CorporateRequestFilesAdmin)
admin_site.register(CorporateRequestResponse, CorporateRequestResponseAdmin)
admin_site.register(Organization, OrganizationAdmin)
admin_site.register(OrganizationInvitation, OrganizationInvitationAdmin)
admin_site.register(OrganizationMembership, OrganizationMembershipAdmin)
admin_site.register(OrganizationPost, OrganizationPostAdmin)
admin_site.register(LegalDocument, LegalDocumentAdmin)
admin_site.register(IntranetProfile, IntranetProfileAdmin)
admin_site.register(DynamicDocument, DynamicDocumentAdmin)
admin_site.register(DocumentSignature, DocumentSignatureAdmin)
admin_site.register(Tag, TagAdmin)
admin_site.register(DocumentFolder, DocumentFolderAdmin)
admin_site.register(DocumentVisibilityPermission, DocumentVisibilityPermissionAdmin)
admin_site.register(DocumentUsabilityPermission, DocumentUsabilityPermissionAdmin)
admin_site.register(DocumentRelationship, DocumentRelationshipAdmin)
admin_site.register(LegalUpdate, LegalUpdateAdmin)
admin_site.register(RecentDocument, RecentDocumentAdmin)
admin_site.register(RecentProcess, RecentProcessAdmin)
admin_site.register(Subscription)
admin_site.register(PaymentHistory)