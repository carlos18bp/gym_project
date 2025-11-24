"""
SPA (Single Page Application) view for handling undefined routes.

This module provides a simple redirect view for routes that don't match Django's
API endpoints, redirecting users to the sign-in page instead of showing a 404 error.
"""
from django.shortcuts import redirect
from django.views import View


class SPAView(View):
    """
    Redirects to sign-in page for all non-API routes.
    
    This view is used as a catch-all for routes that don't match Django's API endpoints.
    Instead of showing a 404 error, it redirects users to the sign-in page, improving
    the user experience when accessing protected routes without authentication.
    """
    
    def get(self, request, *args, **kwargs):
        """
        Handle GET requests by redirecting to sign-in page.
        """
        return redirect('/sign_in')
    
    def post(self, request, *args, **kwargs):
        """
        Handle POST requests by redirecting to sign-in page.
        """
        return redirect('/sign_in')
