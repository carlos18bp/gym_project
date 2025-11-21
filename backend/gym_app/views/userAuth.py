import secrets
import requests
from rest_framework import status
from gym_app.models import User, PasswordCode
from rest_framework.response import Response
from gym_app.utils import generate_auth_tokens
from django.contrib.auth.hashers import make_password
from gym_app.serializers.user import UserSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from gym_app.views.layouts.sendEmail import send_template_email
from django.conf import settings

@api_view(['POST'])
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
    # Get the email from the request data
    email = request.data.get('email')
    
    # Check if the email is already registered
    if User.objects.filter(email=email).exists():
        return Response({'warning': 'The email is already registered.'}, status=status.HTTP_409_CONFLICT)
    
    # Serialize the request data
    serializer = UserSerializer(data=request.data)
    
    # Validate the serialized data
    if serializer.is_valid():
        # Hash the user's password
        serializer.validated_data['password'] = make_password(serializer.validated_data['password'])
        
        # Save the new user to the database
        user = serializer.save()
        
        # Generate JWT tokens for the new user
        refresh = RefreshToken.for_user(user)
        
        # Return the JWT tokens and user data
        return Response({'refresh': str(refresh), 
                         'access': str(refresh.access_token),
                         'user': serializer.data}, 
                         status=status.HTTP_201_CREATED)
    
    # Return validation errors
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def send_verification_code(request):
    """
    Handle sending a sign-on passcode to the user's email.

    This view processes POST requests to generate a 6-digit passcode and send it to the 
    user's email for sign-on purposes. The passcode is also saved in the database.

    Args:
        request (Request): The HTTP request object containing the user's email.

    Returns:
        Response: A Response object with the passcode if sent successfully,
                  or an error message if the email is already registered or if email is missing.
    """
    # Get the email and captcha_token from the request data
    email = request.data.get('email')
    captcha_token = request.data.get('captcha_token')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not captcha_token:
        return Response({'error': 'Captcha verification is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate captcha token with Google
    verification_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": captcha_token,
        "remoteip": request.META.get("REMOTE_ADDR"),
    }
    
    try:
        google_response = requests.post(verification_url, data=payload, timeout=5)
        google_response.raise_for_status()
        captcha_result = google_response.json()
        
        if not captcha_result.get("success", False):
            return Response({'error': 'Captcha verification failed'}, status=status.HTTP_400_BAD_REQUEST)
    except requests.RequestException:
        return Response({'error': 'Error verifying captcha'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Check if the user already exists based on the email
    if User.objects.filter(email=email).exists():
        return Response({'error': 'The email is already registered.'}, status=status.HTTP_409_CONFLICT)

    # Generate a 6-digit passcode using secrets for better security
    passcode = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Send email using HTML template
    context = {"passcode": passcode}
    send_template_email(
        template_name="code_verification",
        subject="Código de verificación",
        to_emails=[email],
        context=context,
    )

    # Return the passcode in the response
    return Response({'passcode': passcode}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    
    if not captcha_token:
        return Response({'error': 'Captcha verification is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate captcha token with Google
    verification_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": captcha_token,
        "remoteip": request.META.get("REMOTE_ADDR"),
    }
    
    try:
        google_response = requests.post(verification_url, data=payload, timeout=5)
        google_response.raise_for_status()
        captcha_result = google_response.json()
        
        if not captcha_result.get("success", False):
            return Response({'error': 'Captcha verification failed'}, status=status.HTTP_400_BAD_REQUEST)
    except requests.RequestException:
        return Response({'error': 'Error verifying captcha'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Retrieve the user based on the email
    user = User.objects.filter(email=email).first()

    # Define a common error response
    error_response = {'error': 'Invalid credentials'}

    if not user:
        return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)

    # Verify password and generate tokens
    if user.check_password(password):
        # Generate authentication tokens for the user
        return Response(generate_auth_tokens(user), status=status.HTTP_200_OK)
    
    return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)


from django.http import JsonResponse
from urllib.request import urlopen
from django.core.files.base import ContentFile

@api_view(['POST'])
def google_login(request):
    """
    Handle user login via Google data.

    This view processes POST requests containing user information from Google,
    and uses it to authenticate the user. If the user does not exist, it creates a new one
    with the provided information, then returns a JWT token.

    Args:
        request (Request): The HTTP request object containing user data from Google.

    Returns:
        JsonResponse: A JsonResponse object with JWT tokens if authentication is successful,
                      or an error message if authentication fails.
    """
    if request.method == 'POST':
        # Extract user data from the request body
        email = request.data.get('email')
        given_name = request.data.get('given_name', '')  # Default to empty string if missing
        family_name = request.data.get('family_name', '')  # Default to empty string if missing
        picture_url = request.data.get('picture')  # Optional picture URL

        # Validate that the email is present
        if not email:
            return Response({'status': 'error', 'error_message': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get or create the user based on the email
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': given_name,
                    'last_name': family_name,
                }
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
    else:
        # Handle invalid request methods
        return Response({'status': 'error', 'error_message': 'Invalid request method.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    

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

    # Update the user's password
    user.password = make_password(new_password)
    user.save()
    
    # Return a success message
    return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    
    if not captcha_token:
        return Response({'error': 'Captcha verification is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate captcha token with Google
    verification_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": captcha_token,
        "remoteip": request.META.get("REMOTE_ADDR"),
    }
    
    try:
        google_response = requests.post(verification_url, data=payload, timeout=5)
        google_response.raise_for_status()
        captcha_result = google_response.json()
        
        if not captcha_result.get("success", False):
            return Response({'error': 'Captcha verification failed'}, status=status.HTTP_400_BAD_REQUEST)
    except requests.RequestException:
        return Response({'error': 'Error verifying captcha'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    send_template_email(
        template_name="code_verification",
        subject=subject_email,
        to_emails=[email],
        context=context,
    )

    # Return a success message
    return Response({'message': 'Password code sent'}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    # Get the passcode, new password, and captcha_token from the request data
    passcode = request.data.get('passcode')
    new_password = request.data.get('new_password')
    captcha_token = request.data.get('captcha_token')

    # Ensure all required fields are provided
    if not passcode or not new_password:
        return Response({'error': 'Passcode and new password are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not captcha_token:
        return Response({'error': 'Captcha verification is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate captcha token with Google
    verification_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": captcha_token,
        "remoteip": request.META.get("REMOTE_ADDR"),
    }
    
    try:
        google_response = requests.post(verification_url, data=payload, timeout=5)
        google_response.raise_for_status()
        captcha_result = google_response.json()
        
        if not captcha_result.get("success", False):
            return Response({'error': 'Captcha verification failed'}, status=status.HTTP_400_BAD_REQUEST)
    except requests.RequestException:
        return Response({'error': 'Error verifying captcha'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        # Search for the passcode in the database
        reset_code = PasswordCode.objects.filter(code=passcode, used=False).first()
        if not reset_code:
            return Response({'error': 'Invalid or expired code'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the user associated with the passcode
        user = reset_code.user

        # Change the user's password
        user.password = make_password(new_password)
        user.save()

        # Mark the passcode as used
        reset_code.used = True
        reset_code.save()

        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)

    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_token(request):
    """
    Endpoint to validate if the JWT token is still valid.
    If the request is authenticated, it returns a 200 response.
    """
    return Response({"detail": "Token is valid"}, status=200)