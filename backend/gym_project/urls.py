from django.conf import settings
from django.urls import path, include, re_path
from gym_app.admin import admin_site
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin_site.urls),    
    path('api/', include('gym_app.urls')),
    path('', TemplateView.as_view(template_name='index.html')),
    path('sign_on/', TemplateView.as_view(template_name='index.html')),
    path('forget_password/', TemplateView.as_view(template_name='index.html')),
    path('policies/terms_of_use', TemplateView.as_view(template_name='index.html')),
    path('policies/privacy_policy', TemplateView.as_view(template_name='index.html')),
    re_path(r'^process_list(?:/(?P<user_id>\d+))?(?:/(?P<display>\w+))?/$',
        TemplateView.as_view(template_name='index.html')),
    re_path(r'^process_detail/(?P<process_id>\d+)(?:/(?P<display>\w+))?/$', 
        TemplateView.as_view(template_name='index.html')),
    re_path(r'^process_form/(?P<action>\w+)(?:/(?P<process_id>\d+))?/$', 
        TemplateView.as_view(template_name='index.html')),
    path('directory_list/', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)