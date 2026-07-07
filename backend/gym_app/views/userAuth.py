import secrets
import jwt
import requests
from rest_framework import status
from gym_app.models import User, PasswordCode, EmailVerificationCode
from rest_framework.response import Response
from gym_app.utils import generate_auth_tokens, verify_captcha
from gym_app.utils.email_notifications import notify_admin_new_user
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from gym_app.serializers.user import UserSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'auth_login'


class PasscodeRateThrottle(AnonRateThrottle):
    scope = 'auth_passcode'


class SignupRateThrottle(AnonRateThrottle):
    scope = 'auth_signup'
from rest_framework_simplejwt.tokens import RefreshToken
from gym_app.views.layouts.sendEmail import send_template_email
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupRateThrottle])
def sign_on(request):
    """
    Handle user registration by creating a new user account.

    This view processes POST requests to register a new user. It checks if the
    email is already registered, validates the user data using the UserSerializer,
    hashes the user's password, and creates a new user. If successful, it returns
    JWT tokens for the user.

    Args:
        request (Request): The HTTP request object containing user data.

    Returns:
        Response: A Response object with the JWT tokens and user data if successful,
                  or an error message if the registration fails.
    """
    # Get the email and passcode from the request data
    email = request.data.get('email')
    passcode = request.data.get('passcode')

    if email:
        email = email.strip().lower()

    # Note: captcha validation lives in send_verification_code (first step).
    # reCAPTCHA v2 tokens are single-use, so we can't re-verify here; the
    # 6-digit emailed passcode (with 30-min TTL) is the bot-proof gate for
    # this step.
    # Check if the email is already registered
    if User.objects.filter(email=email).exists():
        return Response({'warning': 'The email is already registered.'}, status=status.HTTP_409_CONFLICT)

    # Verify passcode server-side (BUG-10)
    if not passcode:
        return Response({'error': 'Verification code is required'}, status=status.HTTP_400_BAD_REQUEST)

    ttl_threshold = timezone.now() - timedelta(minutes=30)
    verification_code = EmailVerificationCode.objects.filter(
        email=email,
        code=passcode,
        used=False,
        created_at__gte=ttl_threshold,
    ).first()
    if not verification_code:
        return Response({'error': 'Invalid or expired verification code'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Serialize the request data
    serializer = UserSerializer(data=request.data)
    
    # Validate the serialized data
    if serializer.is_valid():
        # Ensure default role is 'basic' when not explicitly provided
        if not serializer.validated_data.get('role'):
            serializer.validated_data['role'] = 'basic'

        # Normalize email in validated data
        serializer.validated_data['email'] = email

        # Validate password strength
        try:
            validate_password(serializer.validated_data['password'])
        except ValidationError as e:
            return Response({'error': e.messages}, status=status.HTTP_400_BAD_REQUEST)

        # Hash the user's password
        serializer.validated_data['password'] = make_password(serializer.validated_data['password'])
        
        # Save the new user to the database
        user = serializer.save()

        # Mark verification code as used
        verification_code.used = True
        verification_code.save()

        notify_admin_new_user(user)

        # Generate JWT tokens for the new user
        tokens = generate_auth_tokens(user)
        
        # Return the JWT tokens and user data
        return Response(tokens, status=status.HTTP_201_CREATED)
    
    # Return validation errors
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupRateThrottle])
def send_verification_code(request):
    """
    Handle sending a sign-on passcode to the user's email.

    This view processes POST requests to generate a 6-digit passcode and send it to the 
    user's email for sign-on purposes. The passcode is also saved in the database.

    Args:
        request (Request): The HTTP request object containing the user's email.

    Returns:
        Response: A Response object with a success message if sent successfully,
                  or an error message if the email is already registered or if email is missing.
    """
    # Get the email and captcha_token from the request data
    email = request.data.get('email')
    captcha_token = request.data.get('captcha_token')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip().lower()

    # Validate captcha token with Google
    captcha_ok, captcha_error = verify_captcha(captcha_token, request.META.get("REMOTE_ADDR"))
    if not captcha_ok:
        return captcha_error

    # Check if the user already exists based on the email
    if User.objects.filter(email=email).exists():
        return Response({'error': 'The email is already registered.'}, status=status.HTTP_409_CONFLICT)

    # Generate a 6-digit passcode using secrets for better security
    passcode = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    # Save the verification code in the database
    EmailVerificationCode.objects.create(email=email, code=passcode)
    
    # Send email using HTML template
    context = {"passcode": passcode}
    try:
        send_template_email(
            template_name="code_verification",
            subject="Código de verificación",
            to_emails=[email],
            context=context,
        )
    except Exception:
        return Response({'error': 'Error sending verification email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Return success message (passcode is NOT returned for security)
    return Response({'message': 'Verification code sent successfully.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def sign_in(request):
    """
    Handle user sign-in by validating credentials and generating authentication tokens.

    This view processes POST requests to authenticate a user using email and password only.
    If the credentials are valid, it generates and returns JWT tokens for the user.

    Args:
        request (Request): The HTTP request object containing user credentials (email, password, and captcha_token).

    Returns:
        Response: A Response object with JWT tokens if authentication is successful,
                  or an error message if authentication fails.
    """
    # Get the email, password, and captcha_token from the request data
    email = request.data.get('email')
    password = request.data.get('password')
    captcha_token = request.data.get('captcha_token')

    # Validate required fields
    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip().lower()

    # Validate captcha token with Google
    captcha_ok, captcha_error = verify_captcha(captcha_token, request.META.get("REMOTE_ADDR"))
    if not captcha_ok:
        return captcha_error

    # Retrieve the user based on the email
    user = User.objects.filter(email=email).first()

    # Define a common error response
    error_response = {'error': 'Invalid credentials'}

    if not user:
        return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)

    # Detect social-auth users without a usable password (BUG-11)
    if not user.has_usable_password():
        return Response(
            {'error': 'This account was created with Google or Microsoft/Outlook. Please use "Forgot Password" to set a password.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify password and generate tokens
    if user.check_password(password):
        # Archived accounts are blocked from every login method. Checked
        # only after a successful password so account state never leaks
        # to callers probing with wrong credentials.
        if user.is_archived:
            return Response(
                {'error': 'Tu cuenta ha sido archivada. Contacta al administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Generate authentication tokens for the user
        return Response(generate_auth_tokens(user), status=status.HTTP_200_OK)

    return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)


from urllib.request import urlopen
from django.core.files.base import ContentFile
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def google_login(request):
    """
    Handle user login via Google ID token verification.

    This view processes POST requests containing a Google credential (ID token).
    The token is verified server-side against Google's servers using the project's
    GOOGLE_CLIENT_ID. User information (email, name, picture) is extracted from
    the verified token payload — never trusted from the client directly.

    Args:
        request (Request): The HTTP request object containing the Google credential.

    Returns:
        Response: A Response object with JWT tokens if authentication is successful,
                  or an error message if authentication fails.
    """
    credential = request.data.get('credential')

    if not credential:
        return Response(
            {'status': 'error', 'error_message': 'Google credential is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify the Google ID token server-side
    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        return Response(
            {'status': 'error', 'error_message': 'Invalid Google token.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Extract verified user data from the token payload
    email = idinfo.get('email', '').strip().lower()
    given_name = idinfo.get('given_name', '')
    family_name = idinfo.get('family_name', '')
    picture_url = idinfo.get('picture')

    if not email:
        return Response(
            {'status': 'error', 'error_message': 'Email not found in Google token.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Get or create the user based on the verified email
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': given_name,
                'last_name': family_name,
                'role': 'basic',
            }
        )

        # Archived accounts are blocked from every login method
        if not created and user.is_archived:
            return Response(
                {'status': 'error', 'error_message': 'Tu cuenta ha sido archivada. Contacta al administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if created:
            # If the user was created, handle the optional profile picture
            if picture_url:
                try:
                    # Fetch image from the URL
                    response = urlopen(picture_url, timeout=1)
                    image_data = response.read()

                    # Create a unique filename for the profile photo
                    filename = f"profile_photos/{user.id}_profile.jpg"

                    # Save the image data to the user's photo_profile field
                    user.photo_profile.save(filename, ContentFile(image_data), save=True)
                except Exception as e:
                    print(f"Error saving profile image: {e}")
            else:
                # If no picture is provided, leave the field as null (frontend handles default image)
                user.photo_profile = None
                user.save()

        # Serialize the user data
        serializer = UserSerializer(user)

        # Generate authentication token
        tokens = generate_auth_tokens(user)

        # Return the generated authentication tokens and user data
        return Response({
            'refresh': tokens['refresh'],
            'access': tokens['access'],
            'user': serializer.data,
            'created': created
        }, status=status.HTTP_200_OK)

    except Exception as e:
        # Handle unexpected exceptions
        return Response({'status': 'error', 'error_message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Microsoft Entra (Azure AD) OpenID Connect v2.0 endpoints. The "common"
# authority supports both personal Microsoft accounts (Outlook/Hotmail/Live)
# and work/school accounts (Microsoft 365 / Azure AD).
MICROSOFT_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
MICROSOFT_ISSUER_HOST = 'https://login.microsoftonline.com/'

# Well-known tenant id for personal Microsoft accounts (Outlook/Hotmail/Live).
# Tokens from this tenant carry the account's own verified email.
MICROSOFT_CONSUMERS_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad'

# Reuse a single PyJWKClient so signing keys are cached across requests.
_microsoft_jwks_client = None


def _get_microsoft_jwks_client():
    """Return a cached PyJWKClient for Microsoft's JWKS endpoint."""
    global _microsoft_jwks_client
    if _microsoft_jwks_client is None:
        _microsoft_jwks_client = jwt.PyJWKClient(MICROSOFT_JWKS_URI)
    return _microsoft_jwks_client


def _verify_microsoft_id_token(id_token):
    """
    Verify a Microsoft (Entra ID) ID token server-side.

    Validates the token signature against Microsoft's public JWKS keys and the
    audience against the project's MICROSOFT_CLIENT_ID. Because the "common"
    authority is multi-tenant, the issuer is tenant-specific
    (https://login.microsoftonline.com/{tid}/v2.0), so it is validated manually
    against the expected host prefix instead of a fixed value.

    Args:
        id_token (str): The raw Microsoft ID token (JWT).

    Returns:
        dict: The decoded and verified token claims.

    Raises:
        jwt.InvalidTokenError: If the token signature, audience or issuer is invalid.
    """
    signing_key = _get_microsoft_jwks_client().get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=['RS256'],
        audience=settings.MICROSOFT_CLIENT_ID,
        options={'verify_iss': False},
    )

    issuer = claims.get('iss', '')
    if not issuer.startswith(MICROSOFT_ISSUER_HOST) or not issuer.endswith('/v2.0'):
        raise jwt.InvalidIssuerError('Invalid Microsoft token issuer.')

    return claims


def _microsoft_email_is_verified(claims):
    """
    Return True only when the token proves the email is owned/verified.

    The "common" authority accepts validly-signed tokens from ANY Microsoft
    tenant, including one an attacker self-provisions. Trusting the raw email
    (or the attacker-controllable ``preferred_username``/UPN) would allow nOAuth
    account takeover. The email is trusted only when one of:
      - ``xms_edov`` is True (work/school: email domain is verified-owned), or
      - the token comes from the personal Microsoft (consumers) tenant, where
        the email is the account's own login, or
      - the tenant id is in the operator allowlist ``MICROSOFT_TRUSTED_TENANTS``.
    """
    if claims.get('xms_edov') is True:
        return True
    tid = claims.get('tid')
    if tid == MICROSOFT_CONSUMERS_TENANT_ID:
        return True
    trusted_tenants = getattr(settings, 'MICROSOFT_TRUSTED_TENANTS', ())
    return tid in trusted_tenants


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def outlook_login(request):
    """
    Handle user login via Microsoft (Outlook) ID token verification.

    This view processes POST requests containing a Microsoft ID token. The token
    is verified server-side against Microsoft's public JWKS keys using the
    project's MICROSOFT_CLIENT_ID. User information (email, name) is extracted
    from the verified token payload — never trusted from the client directly.

    The flow mirrors `google_login`: if the email does not exist a new user is
    created, otherwise the existing user is logged in. JWT access/refresh tokens
    are then generated. The email is the unique identifier regardless of the
    auth provider, so an account previously created with Google can also sign in
    with Microsoft using the same email.

    Args:
        request (Request): The HTTP request object containing the Microsoft ID token.

    Returns:
        Response: A Response object with JWT tokens if authentication is successful,
                  or an error message if authentication fails.
    """
    id_token_value = request.data.get('id_token') or request.data.get('credential')

    if not id_token_value:
        return Response(
            {'status': 'error', 'error_message': 'Microsoft ID token is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify the Microsoft ID token server-side
    try:
        claims = _verify_microsoft_id_token(id_token_value)
    except jwt.PyJWTError:
        return Response(
            {'status': 'error', 'error_message': 'Invalid Microsoft token.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Only the `email` claim is used as the account identifier — never
    # `preferred_username`/UPN, which an attacker can set freely in a self-served
    # tenant (nOAuth account-takeover vector).
    email = (claims.get('email') or '').strip().lower()
    full_name = (claims.get('name') or '').strip()

    if not email:
        return Response(
            {'status': 'error', 'error_message': 'Email not found in Microsoft token.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Require proof the email is verified-owned before using it to look up or
    # create an account, to prevent cross-tenant account takeover.
    if not _microsoft_email_is_verified(claims):
        return Response(
            {'status': 'error',
             'error_message': 'No se pudo verificar el correo de tu cuenta de Microsoft.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Split the display name into first/last name (best-effort; name is optional)
    given_name = claims.get('given_name', '')
    family_name = claims.get('family_name', '')
    if not given_name and full_name:
        name_parts = full_name.split(' ', 1)
        given_name = name_parts[0]
        family_name = name_parts[1] if len(name_parts) > 1 else ''

    try:
        # Get or create the user based on the verified email
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': given_name,
                'last_name': family_name,
                'role': 'basic',
            }
        )

        # Archived accounts are blocked from every login method
        if not created and user.is_archived:
            return Response(
                {'status': 'error', 'error_message': 'Tu cuenta ha sido archivada. Contacta al administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Serialize the user data
        serializer = UserSerializer(user)

        # Generate authentication token
        tokens = generate_auth_tokens(user)

        # Return the generated authentication tokens and user data
        return Response({
            'refresh': tokens['refresh'],
            'access': tokens['access'],
            'user': serializer.data,
            'created': created
        }, status=status.HTTP_200_OK)

    except Exception as e:
        # Handle unexpected exceptions
        return Response({'status': 'error', 'error_message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from django.contrib.auth.models import update_last_login

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_password(request):
    """
    Handle updating the authenticated user's password.

    This view processes POST requests to update the password of the authenticated user.
    It checks if the current password is correct before updating to the new password.

    Args:
        request (Request): The HTTP request object containing the current and new passwords.

    Returns:
        Response: A Response object with a success message if the update is successful,
                  or an error message if the current password is incorrect.
    """
    # Get the authenticated user
    user = request.user
    
    # Get the current and new passwords from the request data
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    # Ensure both passwords are provided
    if not current_password or not new_password:
        return Response({'error': 'Both current and new passwords are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the current password is correct
    if not user.check_password(current_password):
        return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate password strength
    try:
        validate_password(new_password, user=user)
    except ValidationError as e:
        return Response({'error': e.messages}, status=status.HTTP_400_BAD_REQUEST)

    # Update the user's password
    user.password = make_password(new_password)
    user.save()
    
    # Return a success message
    return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasscodeRateThrottle])
def send_passcode(request):
    """
    Handle sending a password reset passcode to the user's email.

    This view processes POST requests to generate a 6-digit passcode and send it to the 
    user's email for password reset purposes. The passcode is also saved in the database.

    Args:
        request (Request): The HTTP request object containing the user's email.

    Returns:
        Response: A Response object with a success message if the passcode is sent successfully,
                  or an error message if the user is not found.
    """
    # Get the email, subject_email, and captcha_token from the request data
    email = request.data.get('email')
    subject_email = request.data.get('subject_email')
    captcha_token = request.data.get('captcha_token')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip().lower()

    # Validate captcha token with Google
    captcha_ok, captcha_error = verify_captcha(captcha_token, request.META.get("REMOTE_ADDR"))
    if not captcha_ok:
        return captcha_error

    try:
        # Retrieve the user based on the email
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Generate a 6-digit passcode using secrets for better security
    passcode = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Save the passcode to the database
    PasswordCode.objects.create(user=user, code=passcode)

    # Send email using HTML template (reusing code_verification)
    context = {"passcode": passcode}
    try:
        send_template_email(
            template_name="code_verification",
            subject=subject_email,
            to_emails=[email],
            context=context,
        )
    except Exception:
        return Response({'error': 'Error sending verification email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Return a success message
    return Response({'message': 'Password code sent'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasscodeRateThrottle])
def verify_passcode_and_reset_password(request):
    """
    Verify the passcode and reset the user's password.

    This view processes POST requests to verify the provided passcode. If the passcode is valid,
    it resets the user's password to the new password provided in the request.

    Args:
        request (Request): The HTTP request object containing the passcode and new password.

    Returns:
        Response: A Response object with a success message if the password reset is successful,
                  or an error message if the passcode is invalid or expired.
    """
    # Get the passcode, new password, email, and captcha_token from the request data
    passcode = request.data.get('passcode')
    new_password = request.data.get('new_password')
    email = request.data.get('email')
    captcha_token = request.data.get('captcha_token')

    # Ensure all required fields are provided
    if not passcode or not new_password or not email:
        return Response({'error': 'Passcode, email, and new password are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip().lower()
    
    # Validate captcha token with Google
    captcha_ok, captcha_error = verify_captcha(captcha_token, request.META.get("REMOTE_ADDR"))
    if not captcha_ok:
        return captcha_error

    try:
        # Search for the passcode in the database with TTL of 30 minutes
        ttl_threshold = timezone.now() - timedelta(minutes=30)
        reset_code = PasswordCode.objects.filter(
            code=passcode,
            used=False,
            created_at__gte=ttl_threshold,
        ).first()
        if not reset_code:
            return Response({'error': 'Invalid or expired code'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the user associated with the passcode and validate email matches
        user = reset_code.user
        if user.email.lower() != email:
            return Response({'error': 'Invalid or expired code'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength
        try:
            validate_password(new_password, user=user)
        except ValidationError as e:
            return Response({'error': e.messages}, status=status.HTTP_400_BAD_REQUEST)

        # Change the user's password
        user.password = make_password(new_password)
        user.save()

        # Mark the passcode as used
        reset_code.used = True
        reset_code.save()

        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)

    except User.DoesNotExist:  # pragma: no cover – code uses filter().first(), never raises DoesNotExist
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_token(request):
    """
    Endpoint to validate if the JWT token is still valid.
    If the request is authenticated, it returns a 200 response.
    """
    return Response({"detail": "Token is valid"}, status=200)