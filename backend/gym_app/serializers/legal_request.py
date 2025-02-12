from rest_framework import serializers
from gym_app.models import LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequest

class LegalRequestTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for the LegalRequestType model.
    
    Handles serialization and deserialization of legal request types.
    """
    class Meta:
        model = LegalRequestType
        fields = '__all__'

class LegalDisciplineSerializer(serializers.ModelSerializer):
    """
    Serializer for the LegalDiscipline model.
    
    Handles serialization and deserialization of legal disciplines.
    """
    class Meta:
        model = LegalDiscipline
        fields = '__all__'

class LegalRequestFilesSerializer(serializers.ModelSerializer):
    """
    Serializer for the LegalRequestFiles model.
    
    Handles serialization and deserialization of legal request files.
    """
    class Meta:
        model = LegalRequestFiles
        fields = '__all__'

class LegalRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for the LegalRequest model.
    
    Handles serialization and deserialization of legal requests,
    including nested relationships for request type, discipline, and associated files.
    """
    request_type = LegalRequestTypeSerializer()  # ForeignKey for request_type
    discipline = LegalDisciplineSerializer()  # ForeignKey for discipline
    files = LegalRequestFilesSerializer(many=True)  # ManyToManyField for files

    class Meta:
        model = LegalRequest
        fields = '__all__'