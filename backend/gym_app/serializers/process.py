from rest_framework import serializers
from gym_app.models import Case, CaseFile, Stage, Process
from gym_app.serializers import UserSerializer
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.conf import settings

class CaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = '__all__'

class CaseFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseFile
        fields = '__all__'

class StageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = '__all__'

class ProcessSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True)  # ManyToManyField for stages    
    case = CaseSerializer()  # ForeignKey for case
    case_files = CaseFileSerializer(many=True)  # ManyToManyField for case_files
    client = UserSerializer()  # ForeignKey for client
    lawyer = UserSerializer()  # ForeignKey for lawyer

    class Meta:
        model = Process
        fields = '__all__'

    def update(self, instance, validated_data):
        # Update simple fields
        instance.plaintiff = validated_data.get('plaintiff', instance.plaintiff)
        instance.defendant = validated_data.get('defendant', instance.defendant)
        instance.ref = validated_data.get('ref', instance.ref)
        instance.authority = validated_data.get('authority', instance.authority)
        instance.subcase = validated_data.get('subcase', instance.subcase)

        # Retrieve nested data for stages
        stages_data = validated_data.pop('stages', None)

        # Update stages
        if stages_data is not None:
            # Get existing stage IDs in the instance
            existing_stage_ids = [stage.id for stage in instance.stages.all()]
            # Get the IDs from the new data
            new_stage_ids = [stage.get('id') for stage in stages_data if stage.get('id')]

            # Delete stages that are not in the new data
            for stage_id in existing_stage_ids:
                if stage_id not in new_stage_ids:
                    instance.stages.remove(stage_id)

            # Add or update stages
            for stage_data in stages_data:
                stage_id = stage_data.get('id')
                if stage_id:
                    # If stage exists, update it
                    stage = Stage.objects.get(id=stage_id)
                    stage.status = stage_data.get('status', stage.status)
                    stage.save()
                else:
                    # If no ID, create a new stage
                    new_stage = Stage.objects.create(**stage_data)
                    instance.stages.add(new_stage)

        # Save the updated instance without handling case_files here
        instance.save()
        return instance


