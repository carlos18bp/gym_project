import requests
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response


def verify_captcha(captcha_token, remote_addr):
    """
    Verify a reCAPTCHA token with Google's API.

    Args:
        captcha_token (str): The reCAPTCHA token from the frontend.
        remote_addr (str): The IP address of the client making the request.

    Returns:
        tuple: (success: bool, error_response: Response | None)
            - If verification succeeds: (True, None)
            - If verification fails: (False, Response with error details)
    """
    if not captcha_token:
        return False, Response(
            {'error': 'Captcha verification is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    verification_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": captcha_token,
        "remoteip": remote_addr,
    }

    try:
        google_response = requests.post(verification_url, data=payload, timeout=5)
        google_response.raise_for_status()
        captcha_result = google_response.json()

        if not captcha_result.get("success", False):
            return False, Response(
                {'error': 'Captcha verification failed'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    except requests.RequestException:
        return False, Response(
            {'error': 'Error verifying captcha'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return True, None
