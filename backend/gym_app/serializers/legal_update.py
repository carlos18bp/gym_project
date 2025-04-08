from rest_framework import serializers
from ..models import LegalUpdate

class LegalUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalUpdate
        fields = ['id', 'title', 'content', 'image', 'link_text', 'link_url', 'created_at', 'updated_at', 'is_active']
        read_only_fields = ['created_at', 'updated_at'] 