from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from gym_app.models import User, Process, Stage, CaseFile, Case, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles

class UserAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the User model.
    Display all fields of the User model.
    """
    list_display = (
        'first_name', 'last_name', 'identification', 'marital_status', 
        'email', 'role', 'birthday', 'contact', 'created_at'
    )

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

class CaseAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Case model.
    Display all fields of the Case model.
    """
    list_display = ('type',)  # Display the type of the case

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

class LegalRequestTypeAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestType model.
    Display the name field.
    """
    list_display = ('name',)

class LegalDisciplineAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalDiscipline model.
    Display the name field.
    """
    list_display = ('name',)

class LegalRequestFilesAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the LegalRequestFiles model.
    Display the file and creation date.
    """
    list_display = ('file', 'created_at')

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
