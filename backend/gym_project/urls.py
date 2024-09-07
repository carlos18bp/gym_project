from django.conf import settings
from django.urls import path, include
from gym_app.admin import admin_site
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin_site.urls),    
    path('api/', include('gym_app.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)