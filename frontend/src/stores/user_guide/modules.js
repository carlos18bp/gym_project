import {
  HomeIcon,
  UsersIcon,
  FolderIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  ScaleIcon,
  UserCircleIcon,
  CreditCardIcon
} from '@heroicons/vue/24/outline';

export const allModules = [
  {
    id: 'dashboard',
    name: 'Inicio (Dashboard)',
    icon: HomeIcon,
    roles: ['lawyer', 'client', 'corporate_client', 'basic'],
    description: 'Panel principal con vista general de tu actividad'
  },
  {
    id: 'directory',
    name: 'Directorio',
    icon: UsersIcon,
    roles: ['lawyer'],
    description: 'Listado completo de clientes y usuarios del sistema'
  },
  {
    id: 'processes',
    name: 'Procesos',
    icon: FolderIcon,
    roles: ['lawyer', 'client', 'corporate_client', 'basic'],
    description: 'Gestión y consulta de procesos judiciales'
  },
  {
    id: 'documents',
    name: 'Archivos Jurídicos',
    icon: DocumentTextIcon,
    roles: ['lawyer', 'client', 'corporate_client', 'basic'],
    description: 'Documentos dinámicos, minutas y contratos'
  },
  {
    id: 'requests',
    name: 'Solicitudes Legales',
    icon: InboxArrowDownIcon,
    roles: ['lawyer', 'client', 'corporate_client', 'basic'],
    description: 'Gestión de solicitudes y consultas legales'
  },
  {
    id: 'appointments',
    name: 'Agendar Cita',
    icon: CalendarDaysIcon,
    roles: ['client', 'corporate_client', 'basic'],
    description: 'Sistema de agendamiento de citas con abogados'
  },
  {
    id: 'organizations',
    name: 'Organizaciones',
    icon: BuildingOfficeIcon,
    roles: ['client', 'corporate_client'],
    description: 'Gestión de organizaciones empresariales'
  },
  {
    id: 'intranet',
    name: 'Intranet G&M',
    icon: ScaleIcon,
    roles: ['lawyer'], // Solo para lawyers con is_gym_lawyer
    description: 'Portal interno exclusivo para abogados de G&M'
  },
  {
    id: 'authentication',
    name: 'Autenticación y Cuenta',
    icon: UserCircleIcon,
    roles: ['lawyer', 'client', 'corporate_client', 'basic'],
    description: 'Gestiona tu acceso a la plataforma y configuración de cuenta'
  },
  {
    id: 'subscriptions',
    name: 'Suscripciones y Pagos',
    icon: CreditCardIcon,
    roles: ['lawyer', 'client', 'corporate_client', 'basic'],
    description: 'Gestiona tu plan de suscripción y métodos de pago'
  }
];
