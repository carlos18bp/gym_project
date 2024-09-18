from rest_framework import serializers
from gym_app.models import Case, CaseFile, Stage, Process
from gym_app.serializers import UserSerializer

class CaseSerializer(serializers.ModelSerializer):
    """
    Serializer for the Case model.
    Serializes all fields of the Case model.
    """
    class Meta:
        model = Case
        fields = '__all__'

class CaseFileSerializer(serializers.ModelSerializer):
    """
    Serializer for the CaseFile model.
    Serializes all fields of the CaseFile model.
    """
    class Meta:
        model = CaseFile
        fields = '__all__'

class StageSerializer(serializers.ModelSerializer):
    """
    Serializer for the Stage model.
    Serializes all fields of the Stage model.
    """
    class Meta:
        model = Stage
        fields = '__all__'

class ProcessSerializer(serializers.ModelSerializer):
    """
    Serializer for the Process model.
    Serializes all fields of the Process model.
    Related fields (stages, client, case_files, lawyer) are serialized using nested serializers.
    """
    stages = StageSerializer(many=True)  # ManyToManyField for stages    
    case = CaseSerializer() # ForeignKey for case
    case_files = CaseFileSerializer(many=True)  # ManyToManyField for case_files
    client = UserSerializer()  # ForeignKey for client
    lawyer = UserSerializer()  # ForeignKey for lawyer

    class Meta:
        model = Process
        fields = '__all__'
