from django.conf import settings
from django.urls import path, include, re_path
from gym_app.admin import admin_site
from gym_app.views.spa import SPAView
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin_site.urls),    
    path('api/', include('gym_app.urls')),
    path('', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # In production, serve media files through Django
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all pattern for Vue.js SPA routing
# This must be the last pattern to avoid catching API routes
urlpatterns += [
    re_path(r'^.*$', SPAView.as_view(), name='spa'),
]