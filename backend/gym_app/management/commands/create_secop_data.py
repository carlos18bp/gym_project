import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from gym_app.models import (
    SECOPProcess, ProcessClassification, SECOPAlert,
    AlertNotification, SyncLog, SavedView, User
)


# Colombian departments (realistic subset)
DEPARTMENTS = [
    'Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Cundinamarca',
    'Santander', 'Atlántico', 'Bolívar', 'Nariño', 'Boyacá',
    'Tolima', 'Caldas', 'Risaralda', 'Meta', 'Huila',
]

CITIES = {
    'Antioquia': ['Medellín', 'Envigado', 'Itagüí', 'Bello'],
    'Bogotá D.C.': ['Bogotá D.C.'],
    'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura'],
    'Cundinamarca': ['Soacha', 'Zipaquirá', 'Facatativá'],
    'Santander': ['Bucaramanga', 'Floridablanca', 'Girón'],
    'Atlántico': ['Barranquilla', 'Soledad'],
    'Bolívar': ['Cartagena'],
    'Nariño': ['Pasto', 'Tumaco'],
    'Boyacá': ['Tunja', 'Duitama', 'Sogamoso'],
    'Tolima': ['Ibagué'],
    'Caldas': ['Manizales'],
    'Risaralda': ['Pereira'],
    'Meta': ['Villavicencio'],
    'Huila': ['Neiva'],
}

ENTITIES = [
    'Ministerio de Transporte',
    'Instituto Nacional de Vías - INVIAS',
    'Alcaldía de Medellín',
    'Gobernación de Antioquia',
    'Agencia Nacional de Infraestructura',
    'Ministerio de Salud y Protección Social',
    'Secretaría de Educación de Bogotá',
    'Empresa de Acueducto de Bogotá',
    'Instituto Colombiano de Bienestar Familiar',
    'Servicio Nacional de Aprendizaje - SENA',
    'Departamento Nacional de Planeación',
    'Ministerio de Tecnologías de la Información',
]

PROCUREMENT_METHODS = [
    'Licitación pública',
    'Selección abreviada',
    'Concurso de méritos',
    'Contratación directa',
    'Mínima cuantía',
    'Contratación régimen especial',
]

CONTRACT_TYPES = [
    'Obra', 'Consultoría', 'Prestación de servicios',
    'Suministro', 'Interventoría', 'Compraventa',
]

UNSPSC_CODES = [
    '72101500', '72141000', '72151500', '80101500', '80111600',
    '81101500', '81112200', '85101600', '86101700', '43211500',
    '43232100', '46171600', '42181500', '42182000', '93141500',
    '93151600', '95121600', '78111800', '25101500', '30111600',
]

PROCEDURE_NAMES = [
    'Construcción de vía terciaria tramo {ref}',
    'Consultoría para diseño de acueducto municipal',
    'Prestación de servicios profesionales de asesoría jurídica',
    'Suministro de equipos de cómputo para entidad educativa',
    'Interventoría técnica, administrativa y financiera',
    'Adquisición de insumos médicos hospitalarios',
    'Mantenimiento de infraestructura educativa',
    'Consultoría ambiental para proyecto de infraestructura vial',
    'Servicios de vigilancia y seguridad privada',
    'Obra civil para mejoramiento de espacio público',
]


class Command(BaseCommand):
    help = 'Create fake SECOP data for development and testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--num_processes', type=int, default=30,
            help='Number of SECOP processes to create (default: 30)',
        )
        parser.add_argument(
            '--num_classifications', type=int, default=15,
            help='Number of classifications to create (default: 15)',
        )
        parser.add_argument(
            '--num_alerts', type=int, default=5,
            help='Number of alerts to create (default: 5)',
        )

    def handle(self, *args, **options):
        random.seed(42)
        num_processes = options['num_processes']
        num_classifications = options['num_classifications']
        num_alerts = options['num_alerts']

        lawyer = self._get_or_create_lawyer()
        second_lawyer = self._get_second_lawyer()

        processes = self._create_processes(num_processes)
        self._create_classifications(processes, lawyer, second_lawyer, num_classifications)
        alerts = self._create_alerts(lawyer, num_alerts)
        self._create_notifications(alerts, processes)
        self._create_sync_logs()
        self._create_saved_views(lawyer)

        self.stdout.write(self.style.SUCCESS(
            f'SECOP fake data created: {len(processes)} processes, '
            f'{num_classifications} classifications, {num_alerts} alerts'
        ))

    def _get_or_create_lawyer(self):
        lawyer = User.objects.filter(role='lawyer').first()
        if not lawyer:
            lawyer = User.objects.create_user(
                email='secop_lawyer@test.com',
                password='testpassword',
                first_name='SECOP',
                last_name='Lawyer',
                role='lawyer',
                is_gym_lawyer=True,
            )
            self.stdout.write(self.style.SUCCESS('Created lawyer user for SECOP'))
        return lawyer

    def _get_second_lawyer(self):
        lawyers = User.objects.filter(role='lawyer').exclude(
            email='secop_lawyer@test.com'
        )
        if lawyers.exists():
            return lawyers.first()
        return User.objects.create_user(
            email='secop_lawyer2@test.com',
            password='testpassword',
            first_name='Second',
            last_name='Lawyer',
            role='lawyer',
            is_gym_lawyer=True,
        )

    def _create_processes(self, count):
        now = timezone.now()
        processes = []

        for i in range(count):
            dept = random.choice(DEPARTMENTS)
            city = random.choice(CITIES.get(dept, [dept]))
            entity = random.choice(ENTITIES)

            # Mix of statuses: 60% open, 20% awarded, 20% closed
            rand_val = random.random()
            if rand_val < 0.6:
                status_val = 'Abierto'
                closing_offset = random.randint(5, 60)
                closing_date = now + timedelta(days=closing_offset)
            elif rand_val < 0.8:
                status_val = 'Adjudicado'
                closing_date = now - timedelta(days=random.randint(1, 30))
            else:
                status_val = 'Cerrado'
                closing_date = now - timedelta(days=random.randint(1, 60))

            process_id = f'CO1.REQ.{3900000 + i}'
            reference = f'SA-{random.randint(100, 999)}-{2025 + (i % 2)}-{i:04d}'
            proc_name = random.choice(PROCEDURE_NAMES).format(ref=reference)

            base_price = Decimal(str(random.randint(1_000_000, 50_000_000_000)))
            pub_date = (now - timedelta(days=random.randint(1, 90))).date()

            process, created = SECOPProcess.objects.update_or_create(
                process_id=process_id,
                defaults={
                    'reference': reference,
                    'entity_name': entity,
                    'entity_nit': f'8{random.randint(10000000, 99999999)}-{random.randint(0, 9)}',
                    'department': dept,
                    'city': city,
                    'entity_level': random.choice(['Nacional', 'Territorial']),
                    'procedure_name': proc_name,
                    'description': f'Proceso de {proc_name.lower()} para {entity}.',
                    'phase': random.choice(['Borrador', 'Publicado', 'Evaluación', 'Adjudicado']),
                    'status': status_val,
                    'procurement_method': random.choice(PROCUREMENT_METHODS),
                    'procurement_justification': '',
                    'contract_type': random.choice(CONTRACT_TYPES),
                    'base_price': base_price,
                    'duration_value': random.choice([30, 60, 90, 120, 180, 365]),
                    'duration_unit': random.choice(['Días', 'Meses']),
                    'publication_date': pub_date,
                    'last_update_date': pub_date,
                    'closing_date': closing_date,
                    'process_url': f'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID={process_id}',
                    'unspsc_code': random.choice(UNSPSC_CODES),
                    'raw_data': {'source': 'fake_data'},
                },
            )
            processes.append(process)

            if created:
                self.stdout.write(f'  Created process {process_id}')

        return processes

    def _create_classifications(self, processes, lawyer, second_lawyer, count):
        statuses = list(ProcessClassification.Status.values)
        selected = random.sample(processes, min(count, len(processes)))

        for i, process in enumerate(selected):
            user = lawyer if i % 3 != 2 else second_lawyer
            ProcessClassification.objects.update_or_create(
                process=process,
                user=user,
                defaults={
                    'status': random.choice(statuses),
                    'notes': random.choice([
                        '', 'Revisar con el equipo', 'Requiere análisis presupuestal',
                        'Alta prioridad', 'Pendiente de documentos',
                        'Viable para presentar propuesta',
                    ]),
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f'  Created/updated {len(selected)} classifications'
        ))

    def _create_alerts(self, lawyer, count):
        alert_configs = [
            {
                'name': 'Obras civiles Antioquia',
                'keywords': 'obra, construcción, vía',
                'departments': 'Antioquia',
                'frequency': 'IMMEDIATE',
            },
            {
                'name': 'Consultoría nacional',
                'keywords': 'consultoría, asesoría',
                'min_budget': Decimal('100000000'),
                'frequency': 'DAILY',
            },
            {
                'name': 'TI y tecnología',
                'keywords': 'software, tecnología, sistemas, cómputo',
                'frequency': 'WEEKLY',
            },
            {
                'name': 'Salud Bogotá',
                'keywords': 'salud, médico, hospitalario',
                'departments': 'Bogotá D.C.',
                'frequency': 'DAILY',
            },
            {
                'name': 'Grandes contratos',
                'min_budget': Decimal('5000000000'),
                'max_budget': Decimal('50000000000'),
                'frequency': 'IMMEDIATE',
            },
        ]

        alerts = []
        for config in alert_configs[:count]:
            alert, _ = SECOPAlert.objects.update_or_create(
                user=lawyer,
                name=config['name'],
                defaults={
                    'keywords': config.get('keywords', ''),
                    'entities': config.get('entities', ''),
                    'departments': config.get('departments', ''),
                    'min_budget': config.get('min_budget'),
                    'max_budget': config.get('max_budget'),
                    'procurement_methods': config.get('procurement_methods', ''),
                    'frequency': config['frequency'],
                    'is_active': True,
                },
            )
            alerts.append(alert)

        self.stdout.write(self.style.SUCCESS(f'  Created/updated {len(alerts)} alerts'))
        return alerts

    def _create_notifications(self, alerts, processes):
        count = 0
        for alert in alerts:
            matched = random.sample(processes, min(3, len(processes)))
            for process in matched:
                _, created = AlertNotification.objects.get_or_create(
                    alert=alert,
                    process=process,
                    defaults={
                        'is_sent': random.choice([True, False]),
                        'sent_at': timezone.now() if random.random() > 0.5 else None,
                    },
                )
                if created:
                    count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} alert notifications'))

    def _create_sync_logs(self):
        now = timezone.now()

        SyncLog.objects.get_or_create(
            status=SyncLog.Status.SUCCESS,
            defaults={
                'finished_at': now - timedelta(hours=6),
                'records_processed': 150,
                'records_created': 30,
                'records_updated': 120,
            },
        )

        SyncLog.objects.get_or_create(
            status=SyncLog.Status.FAILED,
            defaults={
                'finished_at': now - timedelta(days=2),
                'records_processed': 45,
                'error_message': 'ConnectionError: datos.gov.co timeout after 30s',
            },
        )

        self.stdout.write(self.style.SUCCESS('  Created sync logs'))

    def _create_saved_views(self, lawyer):
        views_config = [
            {
                'name': 'Antioquia - Obras',
                'filters': {
                    'department': 'Antioquia',
                    'procurement_method': 'Licitación pública',
                    'contract_type': 'Obra',
                },
            },
            {
                'name': 'Bogotá alto presupuesto',
                'filters': {
                    'department': 'Bogotá D.C.',
                    'min_budget': '1000000000',
                },
            },
            {
                'name': 'Consultorías abiertas',
                'filters': {
                    'contract_type': 'Consultoría',
                    'status': 'Abierto',
                },
            },
        ]

        for config in views_config:
            SavedView.objects.update_or_create(
                user=lawyer,
                name=config['name'],
                defaults={'filters': config['filters']},
            )

        self.stdout.write(self.style.SUCCESS('  Created saved views'))
