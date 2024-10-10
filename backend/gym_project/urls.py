from django.conf import settings
from django.urls import path, include
from gym_app.admin import admin_site
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin_site.urls),    
    path('api/', include('gym_app.urls')),
    path('', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)