from rest_framework.decorators import api_view
from rest_framework.response import Response
from gym_app.models import LegalUserLink
from gym_app.serializers import LegalUserLinkSerializer

@api_view(['GET'])
def list_legal_user_links(request, user_id):
    legal_user_links = LegalUserLink.objects.filter(user_id=user_id)
    serializer = LegalUserLinkSerializer(legal_user_links, many=True)
    return Response(serializer.data)
