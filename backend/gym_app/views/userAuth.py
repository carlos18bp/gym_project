import secrets
from rest_framework import status
from django.core.mail import send_mail
from gym_app.models import User, PasswordCode
from rest_framework.response import Response
from gym_app.utils import generate_auth_tokens
from django.contrib.auth.hashers import make_password
from gym_app.serializers.user import UserSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken

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
    # Get the email from the request data
    email = request.data.get('email')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the user already exists based on the email
    if User.objects.filter(email=email).exists():
        return Response({'error': 'The email is already registered.'}, status=status.HTTP_409_CONFLICT)

    # Generate a 6-digit passcode using secrets for better security
    passcode = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Send an email with the passcode
    send_mail(
        'Sign-On Code',
        f'Your sign-on code is: {passcode}',
        'misfotoscmbp@gmail.com',
        [email],
        fail_silently=False,
    )

    # Return the passcode in the response
    return Response({'passcode': passcode}, status=status.HTTP_200_OK)


from django.contrib.auth import authenticate

@api_view(['POST'])
def sign_in(request):
    """
    Handle user sign-in by validating credentials and generating authentication tokens.

    This view processes POST requests to authenticate a user using either a password or
    a passcode. If the credentials are valid, it generates and returns JWT tokens for the user.

    Args:
        request (Request): The HTTP request object containing user credentials.

    Returns:
        Response: A Response object with JWT tokens if authentication is successful,
                  or an error message if authentication fails.
    """
    # Get the email, password, and passcode from the request data
    email = request.data.get('email')
    password = request.data.get('password')
    passcode = request.data.get('passcode')

    # Retrieve the user based on the email
    user = User.objects.filter(email=email).first()

    # Define a common error response
    error_response = {'error': 'Invalid credentials'}

    if not user:
        return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)

    if password:
        # Authenticate using password
        if user.check_password(password):
            auth_user = authenticate(request, email=email, password=password)
            if auth_user:
                # Generate authentication tokens for the user
                return Response(generate_auth_tokens(auth_user), status=status.HTTP_200_OK)
        return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)
    
    elif passcode:
        # Validate the passcode
        passcode_valid = PasswordCode.objects.filter(user=user, code=passcode, used=False).first()
        if passcode_valid:
            passcode_valid.used = True
            passcode_valid.save()
            # Generate authentication tokens for the user
            return Response(generate_auth_tokens(user), status=status.HTTP_200_OK)
    
    return Response(error_response, status=status.HTTP_401_UNAUTHORIZED)


from django.http import JsonResponse
from google.oauth2 import id_token
from google.auth.transport import requests

@api_view(['POST'])
def google_login(request):
    """
    Handle user login via Google OAuth2.

    This view processes POST requests to authenticate a user using a Google OAuth2 token.
    If the token is valid, it creates a new user if necessary and returns JWT tokens for the user.

    Args:
        request (Request): The HTTP request object containing the Google OAuth2 token.

    Returns:
        JsonResponse: A JsonResponse object with JWT tokens if authentication is successful,
                      or an error message if authentication fails.
    """
    if request.method == 'POST':
        # Get the token from the request data
        token = request.POST.get('token')
        if not token:
            return JsonResponse({'status': 'error', 'error_message': 'Token is missing'}, status=400)
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                '931303546385-777cpce87b2ro3lsgvdua25rfqjfgktg.apps.googleusercontent.com'
            )

            # Check the issuer to ensure the token is from Google
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')

            # Get or create the user based on the email
            user, created = User.objects.get_or_create(
                email=idinfo['email'],
                defaults={'first_name': idinfo['given_name'], 'last_name': idinfo['family_name']}
            )

            # Return the generated authentication tokens
            return JsonResponse(generate_auth_tokens(user), status=200)

        except ValueError as e:
            # Handle token validation errors
            return JsonResponse({'status': 'error', 'error_message': str(e)}, status=400)
        except Exception as e:
            # Handle other exceptions
            return JsonResponse({'status': 'error', 'error_message': str(e)}, status=500)
    else:
        # Handle invalid request methods
        return JsonResponse({'status': 'error', 'error_message': 'Invalid request method'}, status=405)


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
    # Get the email from the request data
    email = request.data.get('email')
    subject_email = request.data.get('subject_email')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Retrieve the user based on the email
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Generate a 6-digit passcode using secrets for better security
    passcode = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Save the passcode to the database
    PasswordCode.objects.create(user=user, code=passcode)

    # Send an email with the passcode
    send_mail(
        subject_email,
        f'Your password reset code is: {passcode}',
        'misfotoscmbp@gmail.com',
        [email],
        fail_silently=False,
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
    # Get the passcode and new password from the request data
    passcode = request.data.get('passcode')
    new_password = request.data.get('new_password')

    # Ensure both passcode and new password are provided
    if not passcode or not new_password:
        return Response({'error': 'Passcode and new password are required'}, status=status.HTTP_400_BAD_REQUEST)

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
