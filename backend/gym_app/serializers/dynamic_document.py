from rest_framework import serializers
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable

User = get_user_model()


class DocumentVariableSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = DocumentVariable
        fields = ['id', 'name_en', 'name_es', 'tooltip', 'field_type', 'value']


class DynamicDocumentSerializer(serializers.ModelSerializer):
    # Relación con las variables del documento
    variables = DocumentVariableSerializer(many=True, required=False)

    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)

    class Meta:
        model = DynamicDocument
        fields = ['id', 'title', 'content', 'state', 'created_by', 'assigned_to', 'created_at', 'updated_at', 'variables']

    def create(self, validated_data):
        # Extraer datos de variables
        variables_data = validated_data.pop('variables', [])
        
        # Asignar automáticamente el usuario autenticado
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user

        # Crear el documento
        document = DynamicDocument.objects.create(**validated_data)

        # Crear las variables relacionadas
        for variable_data in variables_data:
            DocumentVariable.objects.create(document=document, **variable_data)

        return document

    def update(self, instance, validated_data):
        # Extraer las variables enviadas en la solicitud
        variables_data = validated_data.pop('variables', [])
        existing_variables = {var.id: var for var in instance.variables.all()}

        # Actualizar los campos principales del documento
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Manejar las variables
        for var_data in variables_data:
            if 'id' in var_data and var_data['id'] in existing_variables:
                # Actualizar variable existente
                variable_instance = existing_variables.pop(var_data['id'])
                for attr, value in var_data.items():
                    setattr(variable_instance, attr, value)
                variable_instance.save()
            else:
                # Crear nueva variable si no tiene id
                DocumentVariable.objects.create(document=instance, **var_data)

        # Eliminar variables no incluidas en la solicitud
        for var_to_delete in existing_variables.values():
            var_to_delete.delete()

        return instance

