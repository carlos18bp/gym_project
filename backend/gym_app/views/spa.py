"""
SPA (Single Page Application) view for handling undefined routes.

This module provides a simple redirect view for routes that don't match Django's
API endpoints, redirecting users to the sign-in page instead of showing a 404 error.

It also serves the Microsoft (MSAL) OAuth redirect URI as a minimal static page,
deliberately kept out of the SPA catch-all.
"""
import os

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render
from django.template import TemplateDoesNotExist
from django.views import View

class SPAView(View):
    """
    Redirects to sign-in page for all non-API routes.
    
    This view is used as a catch-all for routes that don't match Django's API endpoints.
    Instead of showing a 404 error, it redirects users to the sign-in page, improving
    the user experience when accessing protected routes without authentication.
    """
    
    def _render_spa(self, request):
        if not settings.DEBUG:
            try:
                return render(request, 'index.html')
            except TemplateDoesNotExist:
                pass

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
        return self._render_spa(request)
    
    def post(self, request, *args, **kwargs):
        """
        Handle POST requests by serving the SPA index.html.
        """
        return self._render_spa(request)


# Minimal document for the Microsoft (MSAL) popup redirect URI. It carries no
# application JavaScript on purpose: MSAL reads the authorization response from
# this window's URL and closes it, so booting the Vue app here would render the
# sign-in form inside the popup and race with MSAL for the URL fragment.
# It must not call window.close() either — closing it from the page itself would
# destroy the window before MSAL can read the response.
OUTLOOK_CALLBACK_HTML = """<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Autenticacion con Microsoft</title>
  </head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding: 2rem;">
    <p>Autenticacion completada. Puede cerrar esta ventana.</p>
  </body>
</html>
"""


def outlook_callback(request):
    """
    Serve the Microsoft (Entra ID) OAuth redirect URI.

    Registered in Azure as the SPA redirect URI for the Microsoft login popup.
    The response is never cached so the popup always gets a clean document.

    COOP is deliberately relaxed to 'unsafe-none' here, overriding
    SECURE_CROSS_ORIGIN_OPENER_POLICY (SecurityMiddleware only applies its value
    with setdefault). The popup arrives from login.microsoftonline.com, whose
    documents are 'unsafe-none': serving this page with a different COOP puts it
    in a new browsing context group, which severs window.opener. The opener then
    cannot read popup.closed ("Cross-Origin-Opener-Policy policy would block the
    window.closed call") and MSAL never closes the popup nor completes the login.
    Safe here because the page carries no script, no data and no session — the
    only capability it grants is our own tab keeping a handle to the window it
    opened. Do not "harden" this back to same-origin-allow-popups.
    """
    response = HttpResponse(OUTLOOK_CALLBACK_HTML, content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-store"
    response["Cross-Origin-Opener-Policy"] = "unsafe-none"
    return response
