from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from gym_app.models import LegalUserLink
from gym_app.serializers import LegalUserLinkSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_legal_user_links(request, user_id):
    legal_user_links = LegalUserLink.objects.filter(user_id=user_id)
    serializer = LegalUserLinkSerializer(legal_user_links, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
