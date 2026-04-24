from django.db import migrations



def seed_registro_marcario(apps, schema_editor):
    Service = apps.get_model('gym_app', 'Service')
    ServiceStage = apps.get_model('gym_app', 'ServiceStage')
    ServiceField = apps.get_model('gym_app', 'ServiceField')

    service, created = Service.objects.get_or_create(
        slug='registro-marcario',
        defaults={
            'name': 'Registro Marcario',
            'short_title': 'Registro',
            'description': 'Solicitud estructurada para iniciar el tramite de registro marcario.',
            'is_active': True,
            'is_featured': True,
            'featured_order': 1,
        },
    )

    if not created:
        return

    stage_1 = ServiceStage.objects.create(
        service=service,
        title='Datos del Solicitante',
        description='Informacion basica de quien solicita el tramite.',
        order=1,
        is_active=True,
    )

    ServiceField.objects.create(
        stage=stage_1,
        key='nombre_completo',
        label='Nombre completo',
        field_type='input',
        is_required=True,
        order=1,
    )
    ServiceField.objects.create(
        stage=stage_1,
        key='identificacion',
        label='Identificacion',
        field_type='input',
        is_required=True,
        order=2,
    )
    ServiceField.objects.create(
        stage=stage_1,
        key='correo_contacto',
        label='Correo electronico',
        field_type='email',
        is_required=True,
        order=3,
    )
    ServiceField.objects.create(
        stage=stage_1,
        key='telefono_contacto',
        label='Telefono',
        field_type='input',
        is_required=False,
        order=4,
    )

    stage_2 = ServiceStage.objects.create(
        service=service,
        title='Informacion de la Marca',
        description='Datos de la marca a registrar.',
        order=2,
        is_active=True,
    )

    ServiceField.objects.create(
        stage=stage_2,
        key='nombre_marca',
        label='Nombre de la marca',
        field_type='input',
        is_required=True,
        order=1,
    )
    ServiceField.objects.create(
        stage=stage_2,
        key='tipo_marca',
        label='Tipo de marca',
        field_type='select_single',
        is_required=True,
        order=2,
        options=['Nominativa', 'Figurativa', 'Mixta'],
    )
    ServiceField.objects.create(
        stage=stage_2,
        key='descripcion_marca',
        label='Descripcion de la marca',
        field_type='text_area',
        is_required=True,
        order=3,
    )

    stage_3 = ServiceStage.objects.create(
        service=service,
        title='Documentos',
        description='Carga de soportes requeridos.',
        order=3,
        is_active=True,
    )

    ServiceField.objects.create(
        stage=stage_3,
        key='logo_marca',
        label='Logo de la marca',
        field_type='file',
        is_required=True,
        order=1,
        allowed_extensions=['.jpg', '.png', '.pdf'],
        allow_multiple_files=False,
        max_files=1,
    )
    ServiceField.objects.create(
        stage=stage_3,
        key='certificado_existencia',
        label='Certificado de existencia',
        field_type='file',
        is_required=True,
        order=2,
        allowed_extensions=['.jpg', '.png', '.pdf'],
        allow_multiple_files=False,
        max_files=1,
    )
    ServiceField.objects.create(
        stage=stage_3,
        key='poder',
        label='Poder',
        field_type='file',
        is_required=False,
        order=3,
        allowed_extensions=['.jpg', '.png', '.pdf'],
        allow_multiple_files=False,
        max_files=1,
    )

    stage_4 = ServiceStage.objects.create(
        service=service,
        title='Confirmacion',
        description='Revision final y aceptacion de terminos.',
        order=4,
        is_active=True,
    )

    ServiceField.objects.create(
        stage=stage_4,
        key='acepta_terminos',
        label='Aceptacion de terminos',
        field_type='select_single',
        is_required=True,
        order=1,
        options=['Si'],
    )
    ServiceField.objects.create(
        stage=stage_4,
        key='observaciones',
        label='Observaciones adicionales',
        field_type='text_area',
        is_required=False,
        order=2,
    )



def unseed_registro_marcario(apps, schema_editor):
    Service = apps.get_model('gym_app', 'Service')
    Service.objects.filter(slug='registro-marcario').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('gym_app', '0057_servicefield_servicerequestsequence_alter_user_role_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_registro_marcario, unseed_registro_marcario),
    ]
