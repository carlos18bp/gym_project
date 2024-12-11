from rest_framework import serializers
from gym_app.models import LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequest

class LegalRequestTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalRequestType
        fields = '__all__'

class LegalDisciplineSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalDiscipline
        fields = '__all__'

class LegalRequestFilesSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalRequestFiles
        fields = '__all__'

class LegalRequestSerializer(serializers.ModelSerializer):
    request_type = LegalRequestTypeSerializer()  # ForeignKey for request_type
    discipline = LegalDisciplineSerializer()  # ForeignKey for discipline
    files = LegalRequestFilesSerializer(many=True)  # ManyToManyField for files

    class Meta:
        model = LegalRequest
        fields = '__all__'
