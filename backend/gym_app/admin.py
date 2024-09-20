from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from gym_app.models import User, Process, Stage, CaseFile, Case

class UserAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the User model.
    Display all fields of the User model.
    """
    list_display = (
        'first_name', 'last_name', 'identification', 'marital_status', 
        'email', 'role', 'birthday', 'contact'
    )

class ProcessAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Process model.
    Display all fields of the Process model.
    """
    list_display = (
        'ref', 'authority', 'plaintiff', 'defendant', 
        'client', 'lawyer', 'case', 'subcase'
    )
    filter_horizontal = ('stages', 'case_files')  # This adds a better UI for ManyToMany fields

class CaseAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Case model.
    Display all fields of the Case model.
    """
    list_display = ('type',)  # Display the type of the case

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
            }
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
