from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from gym_app.models import User, Process, Stage, CaseFile, Case, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalDocument, DynamicDocument, DocumentVariable

class UserAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the User model.
    Display all fields of the User model.
    """
    list_display = (
        'first_name', 'last_name', 'document_type', 'identification',
        'email', 'role', 'birthday', 'contact', 'created_at'
    )
    search_fields = ('first_name', 'last_name', 'email', 'identification', 'role', 'document_type')
    list_filter = ('role', 'document_type', 'created_at')

class LegalDocumentAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalDocument model.
    Display relevant fields for the admin interface.
    """
    list_display = ('name', 'file')  # Display the document name and file field in the admin list view
    search_fields = ('name',)        # Enable search by document name
    list_filter = ('name',)          # Enable filtering by document name

class ProcessAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Process model.
    Display all fields of the Process model.
    """
    list_display = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client', 'lawyer', 'case', 'subcase', 'created_at'
    )
    filter_horizontal = ('stages', 'case_files')  # This adds a better UI for ManyToMany fields
    search_fields = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client__email', 'lawyer__email', 'case__type', 'subcase', 'created_at'
    )  # Enables searching by these fields
    list_filter = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client', 'lawyer', 'case', 'subcase', 'created_at'
    )  # Enables filtering by these fields

class CaseAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Case model.
    Display all fields of the Case model.
    """
    list_display = ('type',)  # Display the type of the case
    search_fields = ('type',)  # Enable searching by the type of the case
    list_filter = ('type',)  # Enable filtering by the type of the case

class LegalRequestAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequest model.
    Display relevant fields for the admin interface.
    """
    list_display = (
        'first_name', 'last_name', 'email', 'request_type', 
        'discipline', 'description', 'created_at'
    )
    filter_horizontal = ('files',)  # Better UI for ManyToMany fields
    search_fields = (
        'first_name', 'last_name', 'email', 
        'request_type__name', 'discipline__name', 'description', 'created_at'
    )  # Enable searching by these fields
    list_filter = (
        'request_type', 'discipline', 'created_at'
    )  # Enable filtering by request type and discipline

class LegalRequestTypeAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestType model.
    Display the name field.
    """
    list_display = ('name',)
    search_fields = ('name',)  # Enable searching by name
    list_filter = ('name',)  # Enable filtering by name

class LegalDisciplineAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalDiscipline model.
    Display the name field.
    """
    list_display = ('name',)
    search_fields = ('name',)  # Enable searching by name
    list_filter = ('name',)  # Enable filtering by name


class LegalRequestFilesAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestFiles model.
    Display the file and creation date.
    """
    list_display = ('file', 'created_at')
    search_fields = ('file',)  # Enable searching by file name
    list_filter = ('created_at',)  # Enable filtering by creation date

class DocumentVariableInline(admin.StackedInline):
    """
    Inline configuration to manage document variables within the DynamicDocument admin.
    """
    model = DocumentVariable
    extra = 1  # Display one empty inline by default
    verbose_name = "Variable"
    verbose_name_plural = "Variables"

class DynamicDocumentAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the DynamicDocument model.
    """
    list_display = ('title', 'created_by', 'assigned_to', 'created_at', 'updated_at')
    search_fields = ('title', 'content', 'created_by__email', 'assigned_to__email')
    list_filter = ('created_at', 'updated_at', 'state')
    inlines = [DocumentVariableInline]  # Add inline for managing document variables

    fieldsets = (
        (None, {
            'fields': ('title', 'content', 'state')
        }),
        ('User Management', {
            'fields': ('created_by', 'assigned_to')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')  # Make timestamps read-only

# Custom AdminSite to organize models by sections
class GyMAdminSite(admin.AdminSite):
    site_header = 'G&M App Administration'
    site_title = 'G&M Admin'
    index_title = 'Welcome to G&M App Control Panel'

    def get_app_list(self, request):
        app_dict = self._build_app_dict(request)
        # Custom structure for the admin index
        custom_app_list = [
            {
                'name': _('User Management'),
                'app_label': 'user_management',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['User']
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
                    if model['object_name'] in ['LegalRequest', 'LegalRequestType', 'LegalDiscipline', 'LegalRequestFiles']
                ]
            },
            {
                'name': _('Dynamic Document Generate'),
                'app_label': 'dynamic_document',
                'models': [
                    model for model in app_dict.get('gym_app', {}).get('models', [])
                    if model['object_name'] in ['DynamicDocument']
                ]
            },
        ]
        return custom_app_list


# Create an instance of the custom AdminSite
admin_site = GyMAdminSite(name='myadmin')

# Register models with the custom AdminSite
admin_site.register(User, UserAdmin)
admin_site.register(Process, ProcessAdmin)
admin_site.register(Case, CaseAdmin)  # Register Case with CaseAdmin
admin_site.register(Stage)
admin_site.register(CaseFile)
admin_site.register(LegalRequest, LegalRequestAdmin)
admin_site.register(LegalRequestType, LegalRequestTypeAdmin)
admin_site.register(LegalDiscipline, LegalDisciplineAdmin)
admin_site.register(LegalRequestFiles, LegalRequestFilesAdmin)
admin_site.register(LegalDocument, LegalDocumentAdmin)
admin_site.register(DynamicDocument, DynamicDocumentAdmin)