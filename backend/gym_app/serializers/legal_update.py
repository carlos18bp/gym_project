from rest_framework import serializers
from gym_app.models import LegalUpdate

class LegalUpdateSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = LegalUpdate
        fields = ['id', 'title', 'content', 'image', 'image_url', 'link_text', 'link_url', 'created_at', 'updated_at', 'is_active']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None 