from rest_framework import serializers
from gym_app.models import Process
from gym_app.serializers import CaseFileSerializer, UserSerializer, StageSerializer


class ProcessSerializer(serializers.ModelSerializer):
    """
    Serializer for the Process model.
    Serializes all fields of the Process model.
    Related fields (stages, client, case_files, lawyer) are serialized using nested serializers.
    """
    stages = StageSerializer(many=True)  # ManyToManyField for stages
    client = UserSerializer()  # ForeignKey for client
    case_files = CaseFileSerializer(many=True)  # ManyToManyField for case_files
    lawyer = UserSerializer()  # ForeignKey for lawyer

    class Meta:
        model = Process
        fields = '__all__'
