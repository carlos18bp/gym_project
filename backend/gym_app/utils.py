from gym_app.serializers.user import UserSerializer
from rest_framework_simplejwt.tokens import RefreshToken

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