"""
SPA (Single Page Application) view for handling undefined routes.

This module provides a simple redirect view for routes that don't match Django's
API endpoints, redirecting users to the sign-in page instead of showing a 404 error.
"""
import os

from django.conf import settings
from django.http import HttpResponse
from django.views import View

class SPAView(View):
    """
    Redirects to sign-in page for all non-API routes.
    
    This view is used as a catch-all for routes that don't match Django's API endpoints.
    Instead of showing a 404 error, it redirects users to the sign-in page, improving
    the user experience when accessing protected routes without authentication.
    """
    
    def _render_spa(self):
        base_dir = settings.BASE_DIR
        project_root = base_dir.parent
        static_root = getattr(settings, "STATIC_ROOT", None)
        candidate_paths = [
            os.path.join(project_root, "frontend", "dist", "index.html"),
            os.path.join(base_dir, "static", "frontend", "index.html"),
        ]
        if static_root:
            candidate_paths.append(os.path.join(static_root, "frontend", "index.html"))
        for path in candidate_paths:
            if os.path.exists(path):
                with open(path, encoding="utf-8") as spa_file:
                    content = spa_file.read()
                return HttpResponse(content, content_type="text/html; charset=utf-8")
        return HttpResponse("SPA index.html not found.", status=500)
    
    def get(self, request, *args, **kwargs):
        """
        Handle GET requests by serving the SPA index.html.
        """
        return self._render_spa()
    
    def post(self, request, *args, **kwargs):
        """
        Handle POST requests by serving the SPA index.html.
        """
        return self._render_spa()
