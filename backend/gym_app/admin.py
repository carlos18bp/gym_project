from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from gym_app.models import User, Process, Stage, CaseFile, Case, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequestResponse, LegalDocument, DynamicDocument, DocumentVariable, LegalUpdate, RecentDocument, RecentProcess, DocumentSignature, Tag, DocumentVisibilityPermission, DocumentUsabilityPermission, DocumentFolder, DocumentRelationship
from gym_app.models.user import UserSignature

class UserAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the User model.
    Displays and manages user information in the admin interface.
    """
    list_display = (
        'first_name', 'last_name', 'document_type', 'identification',
        'email', 'role', 'birthday', 'contact', 'created_at'
    )
    search_fields = ('first_name', 'last_name', 'email', 'identification', 'role', 'document_type')
    list_filter = ('role', 'document_type', 'created_at')

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

class ProcessAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Process model.
    Provides comprehensive management of legal processes.
    """
    list_display = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client', 'lawyer', 'case', 'subcase', 'created_at'
    )
    filter_horizontal = ('stages', 'case_files')
    search_fields = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client__email', 'lawyer__email', 'case__type', 'subcase', 'created_at'
    )
    list_filter = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client', 'lawyer', 'case', 'subcase', 'created_at'
    )

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
                    if model['object_name'] in ['LegalDocument']
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
admin_site.register(LegalDocument, LegalDocumentAdmin)
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