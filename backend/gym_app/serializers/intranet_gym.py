from rest_framework import serializers
from gym_app.models.intranet_gym import LegalDocument

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


