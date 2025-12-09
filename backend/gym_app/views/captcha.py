import json
import logging
from typing import Dict

import requests
from django.conf import settings
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

logger = logging.getLogger(__name__)


def _build_response(data: Dict, status: int = 200) -> JsonResponse:
    """Utility helper to build JSON responses and log the payload."""
    return JsonResponse(data, status=status)


@require_GET
def get_site_key(request: HttpRequest) -> JsonResponse:
    """Return the public reCAPTCHA site key.

    Endpoint: GET /google-captcha/site-key/
    """
    return _build_response({"site_key": settings.RECAPTCHA_SITE_KEY})


@csrf_exempt  # Allow requests without CSRF token (ensure security by other means if required)
@require_POST
def verify_recaptcha(request: HttpRequest) -> JsonResponse:
    """Validate the reCAPTCHA token received from the frontend with Google's API.

    The request body can be JSON or form-encoded and must contain the field ``token``.
    Returns a JSON payload: ``{"success": bool}`` indicating whether validation succeeded.
    """
    # Try to fetch the token from different possible locations
    token = request.POST.get("token")
    if not token and request.body:
        try:
            body_data = json.loads(request.body.decode())
            token = body_data.get("token")
        except json.JSONDecodeError:
            pass

    if not token:
        return _build_response({"success": False, "error": "Token not provided."}, status=400)

    verification_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": token,
        "remoteip": request.META.get("REMOTE_ADDR"),
    }

    try:
        google_response = requests.post(verification_url, data=payload, timeout=5)
        google_response.raise_for_status()
        result = google_response.json()
        success = result.get("success", False)
        # You can inspect score or action here if you are using reCAPTCHA v3.
        return _build_response({"success": success, "result": result})
    except requests.RequestException as exc:
        logger.error("Error verifying reCAPTCHA token: %s", exc, exc_info=True)
        return _build_response({"success": False, "error": "Error verifying token."}, status=500) 