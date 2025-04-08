from rest_framework.response import Response
from rest_framework import status
from gym_app.models import User
from gym_app.models.user import ActivityFeed
from gym_app.serializers.user import UserSerializer, ActivityFeedSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.core.files.storage import default_storage

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    """
    API view to retrieve a list of users (requires authentication).
    """
    users = User.objects.all()
    serializer = UserSerializer(users, many=True, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile(request, pk):
    """
    Handle updating the user's profile by their ID (pk).

    This view processes PUT requests to update the profile of the user specified by the ID (pk).
    It uses the UserSerializer to validate and save the updated user data. The view also supports
    updating the user's profile photo if a file is provided. Additionally, it ensures that only 
    the authenticated user can update their own profile.

    Args:
        request (Request): The HTTP request object containing user data, including optional file data (photo_profile).
        pk (int): The primary key (ID) of the user to be updated.

    Returns:
        Response: A Response object with a success message if the update is successful, or an error message if it fails.
    """
    # Ensure that the authenticated user is updating their own profile
    if request.user.id != pk:
        return Response({'error': 'You do not have permission to update this profile'}, status=status.HTTP_403_FORBIDDEN)

    try:
        # Retrieve the user by their ID (pk)
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Serialize the request data with the retrieved user instance
    serializer = UserSerializer(instance=user, data=request.data, partial=True)

    # Validate the serialized data
    if serializer.is_valid():
        # Check if a profile photo has been included in the request
        if 'photo_profile' in request.FILES:
            # Get the uploaded photo
            photo = request.FILES['photo_profile']
            # Save the photo to the 'profile_photos/' directory using the default storage system
            filename = default_storage.save(f'profile_photos/{photo.name}', photo)
            # Assign the saved filename to the user's photo_profile field
            user.photo_profile = filename
        
        # Save the validated data, including any profile photo updates
        serializer.save()

        # Check if the user profile is completely filled
        required_fields = [
            user.first_name,
            user.last_name,
            user.contact,
            user.birthday,
            user.identification,
            user.email,
            user.document_type,
        ]
        # If all required fields have a value, mark is_profile_completed as True
        if all(required_fields):
            user.is_profile_completed = True
        else:
            user.is_profile_completed = False

        # Save the updated is_profile_completed value
        user.save()

        # Return a success message after updating the profile
        return Response({'message': 'Profile updated successfully'}, status=status.HTTP_200_OK)

    # Return any validation errors that occurred
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_activities(request):
    """
    API view to retrieve the activities of the authenticated user.
    
    Returns a list of activities in chronological order (newest first).
    """
    activities = ActivityFeed.objects.filter(user=request.user)
    serializer = ActivityFeedSerializer(activities, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_activity(request):
    """
    API view to create a new activity for a user.
    
    The request must include:
    - action_type: one of 'create', 'edit', 'finish', 'delete', 'update', 'other'
    - description: text describing the action
    
    The user is automatically set to the authenticated user.
    """
    # Create a copy of request data to make it mutable
    data = request.data.copy()
    # Set the user to the authenticated user
    data['user'] = request.user.id
    
    serializer = ActivityFeedSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
