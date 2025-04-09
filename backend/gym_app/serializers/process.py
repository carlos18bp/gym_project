from rest_framework import serializers
from gym_app.models import Case, CaseFile, Stage, Process, RecentProcess
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
    Includes nested serializers for related models:
    - Stages (ManyToManyField)
    - Case (ForeignKey)
    - Case Files (ManyToManyField)
    - Client (ForeignKey to User)
    - Lawyer (ForeignKey to User)
    """
    stages = StageSerializer(many=True)  # ManyToManyField for stages    
    case = CaseSerializer()  # ForeignKey for case
    case_files = CaseFileSerializer(many=True)  # ManyToManyField for case_files
    client = UserSerializer()  # ForeignKey for client
    lawyer = UserSerializer()  # ForeignKey for lawyer

    class Meta:
        model = Process
        fields = '__all__'

    def update(self, instance, validated_data):
        """
        Updates an existing Process instance.
        
        - Updates simple fields such as plaintiff, defendant, ref, authority, and subcase.
        - Updates related stages:
            - Removes stages that are no longer present.
            - Updates existing stages based on their ID.
            - Creates new stages if no ID is provided.
        - The update for case_files is not handled in this method.
        
        :param instance: The existing Process instance to be updated.
        :param validated_data: The validated data for the update.
        :return: The updated Process instance.
        """
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

class RecentProcessSerializer(serializers.ModelSerializer):
    """
    Serializer for the RecentProcess model.
    Includes the nested ProcessSerializer to show process details.
    """
    process = ProcessSerializer(read_only=True)
    
    class Meta:
        model = RecentProcess
        fields = ['id', 'process', 'last_viewed']
