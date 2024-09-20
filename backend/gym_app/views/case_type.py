from rest_framework.response import Response
from rest_framework import status
from gym_app.models import Case
from gym_app.serializers.process import CaseSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def case_list(request):
    """
    API view to retrieve a list of cases (requires authentication).
    """
    cases = Case.objects.all()
    serializer = CaseSerializer(cases, many=True, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)

