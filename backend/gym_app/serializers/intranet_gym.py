from rest_framework import serializers
from gym_app.models.intranet_gym import LegalDocument, IntranetProfile

class LegalDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer for the LegalDocument model.

    This serializer handles the serialization and deserialization of 
    LegalDocument objects, allowing them to be converted to and from JSON.
    """

    # Custom field to return the absolute URL of the file
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = LegalDocument
        fields = ['id', 'name', 'file', 'file_url']  # Include file_url

    def get_file_url(self, obj):
        """
        Build an absolute URL for the file field using the current request.
        """
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class IntranetProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for the IntranetProfile model.
    """
    cover_image_url = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = IntranetProfile
        fields = ['id', 'cover_image', 'cover_image_url', 'profile_image', 'profile_image_url']

    def get_cover_image_url(self, obj):
        """
        Build an absolute URL for the cover_image field using the current request.
        """
        if obj.cover_image:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None

    def get_profile_image_url(self, obj):
        """
        Build an absolute URL for the profile_image field using the current request.
        """
        if obj.profile_image:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None


