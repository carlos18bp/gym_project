from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from ..models import LegalUpdate
from ..serializers import LegalUpdateSerializer

class LegalUpdateViewSet(viewsets.ModelViewSet):
    queryset = LegalUpdate.objects.filter(is_active=True)
    serializer_class = LegalUpdateSerializer

    def get_queryset(self):
        return LegalUpdate.objects.filter(is_active=True).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def active_updates(self, request):
        updates = self.get_queryset()
        serializer = self.get_serializer(updates, many=True)
        return Response(serializer.data) 