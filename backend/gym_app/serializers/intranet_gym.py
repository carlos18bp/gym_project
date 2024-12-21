from rest_framework import serializers
from gym_app.models.intranet_gym import LegalLink

class LegalLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalLink
        fields = '__all__'