from gym_app.serializers.user import UserSerializer
from rest_framework_simplejwt.tokens import RefreshToken


def is_gym_staff(user):
    """Return True for users with unrestricted internal access (gym lawyers, admin, staff).

    Role comparison is case-insensitive because legacy data uses both
    'lawyer' and 'Lawyer' interchangeably; the same applies to 'admin'.
    """
    role = (getattr(user, 'role', '') or '').lower()
    return (
        getattr(user, 'is_gym_lawyer', False)
        or user.is_staff
        or user.is_superuser
        or role in ('lawyer', 'admin')
    )


def generate_auth_tokens(user):
    """
    Generate JWT authentication tokens for the given user.

    This function creates a new refresh token and access token for the specified user
    and serializes the user's data for inclusion in the response.

    Args:
        user (User): The user instance for which to generate tokens.

    Returns:
        dict: A dictionary containing the refresh token, access token, and serialized user data.
    """
    # Generate a new refresh token for the user
    refresh = RefreshToken.for_user(user)
    
    # Serialize the user's data
    user_data = UserSerializer(user).data
    
    # Return the tokens and user data in a dictionary
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': user_data
    }
