import { defineStore } from 'pinia';
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

export const useUserGuideStore = defineStore('userGuide', {
  state: () => ({
    guideContent: {},
    initialized: false
  }),

  getters: {
    /**
     * Get modules available for a specific role
     */
    getModulesForRole: (state) => (role) => {
      const allModules = [
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

      return allModules.filter(module => module.roles.includes(role));
    },

    /**
     * Get content for a specific module and role
     */
    getModuleContent: (state) => (moduleId, role) => {
      if (!state.guideContent[moduleId]) return null;
      
      const content = state.guideContent[moduleId];
      
      // Create a copy to avoid mutating the state
      const contentCopy = { ...content };
      
      // Filter sections based on role if needed
      if (contentCopy.sections) {
        contentCopy.sections = contentCopy.sections.filter(section => {
          if (!section.roles) return true;
          return section.roles.includes(role);
        });
      }
      
      return contentCopy;
    },

    /**
     * Search through guide content
     */
    searchGuideContent: (state) => (query) => {
      const results = [];
      const lowerQuery = query.toLowerCase();

      Object.entries(state.guideContent).forEach(([moduleId, module]) => {
        // Search in module name and description
        if (module.name?.toLowerCase().includes(lowerQuery) ||
            module.description?.toLowerCase().includes(lowerQuery)) {
          results.push({
            module: module.name,
            section: 'General',
            title: module.name,
            snippet: module.description,
            moduleId: moduleId,
            sectionId: null,
            icon: module.icon || DocumentTextIcon
          });
        }

        // Search in sections
        if (module.sections) {
          module.sections.forEach(section => {
            if (section.name?.toLowerCase().includes(lowerQuery) ||
                section.description?.toLowerCase().includes(lowerQuery) ||
                section.content?.toLowerCase().includes(lowerQuery)) {
              results.push({
                module: module.name,
                section: section.name,
                title: section.name,
                snippet: section.description || section.content?.substring(0, 150),
                moduleId: moduleId,
                sectionId: section.id,
                icon: module.icon || DocumentTextIcon
              });
            }

            // Search in features
            if (section.features) {
              section.features.forEach(feature => {
                if (feature.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    module: module.name,
                    section: section.name,
                    title: feature,
                    snippet: `Funcionalidad: ${feature}`,
                    moduleId: moduleId,
                    sectionId: section.id,
                    icon: module.icon || DocumentTextIcon
                  });
                }
              });
            }
          });
        }
      });

      return results;
    }
  },

  actions: {
    /**
     * Initialize guide content
     */
    initializeGuideContent() {
      if (this.initialized) return;

      this.guideContent = {
        dashboard: {
          name: 'Inicio (Dashboard)',
          icon: HomeIcon,
          description: 'Panel principal con vista general de tu actividad en la plataforma',
          overview: `
            <p>El Dashboard es tu punto de partida en la plataforma G&M Abogados. Aquí encontrarás un resumen de toda tu actividad y accesos rápidos a las funcionalidades más importantes.</p>
          `,
          sections: [
            {
              id: 'welcome-card',
              name: 'Tarjeta de Bienvenida',
              description: 'Información personalizada y estadísticas',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>La tarjeta de bienvenida te saluda con tu nombre y muestra información relevante según tu rol.</p>
              `,
              features: [
                'Saludo personalizado con tu nombre',
                'Contador de procesos activos',
                'Botón de acción rápida contextual'
              ]
            },
            {
              id: 'activity-feed',
              name: 'Feed de Actividad',
              description: 'Historial de tus acciones recientes',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El feed de actividad muestra un registro cronológico de todas tus acciones en la plataforma.</p>
              `,
              features: [
                'Creación y actualización de procesos',
                'Firma de documentos',
                'Creación de minutas',
                'Edición de contenido de documentos jurídicos',
                'Rechazo de documentos y correcciones reenviadas para firma',
                'Actualización de perfil',
                'Scroll infinito para ver más actividades'
              ]
            },
            {
              id: 'quick-actions',
              name: 'Botones de Acción Rápida',
              description: 'Accesos directos a funciones principales',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Los botones de acción rápida cambian según tu rol y te dan acceso inmediato a las funciones que más utilizas.</p>
              `,
              features: [
                'Para Abogados: Todos los Procesos, Radicar Proceso, Nueva Minuta, Radicar Informe',
                'Para Clientes: Mis Procesos, Agendar Cita, Nueva Solicitud'
              ],
              tips: [
                'Los botones cambian según tu rol para mostrarte solo las opciones relevantes',
                'Usa estos botones para acceder rápidamente sin navegar por el menú'
              ]
            },
            {
              id: 'recent-items',
              name: 'Elementos Recientes',
              description: 'Procesos y documentos visitados recientemente',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Accede rápidamente a los últimos 5 procesos y documentos que has visualizado o editado.</p>
              `,
              features: [
                'Lista de procesos recientes',
                'Lista de documentos recientes',
                'Acceso con un solo click'
              ]
            },
            {
              id: 'legal-updates',
              name: 'Actualizaciones Legales',
              description: 'Noticias y actualizaciones del sector legal',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El dashboard incluye un carrusel de <strong>actualizaciones legales</strong> con noticias relevantes del sector. Los abogados pueden crear, editar y eliminar estas actualizaciones.</p>
              `,
              features: [
                'Carrusel de noticias legales en el dashboard',
                'Título, contenido y enlaces en cada actualización',
                'Crear nueva actualización (solo abogados)',
                'Editar actualización existente (solo abogados)',
                'Eliminar actualización con confirmación (solo abogados)',
                'Estado activo/inactivo para cada actualización'
              ],
              steps: [
                {
                  title: 'Ver Actualizaciones',
                  description: 'En el dashboard, navega al carrusel de actualizaciones legales'
                },
                {
                  title: 'Crear Actualización (Abogados)',
                  description: 'Click en "Nueva Actualización" y completa título, contenido y estado'
                },
                {
                  title: 'Editar (Abogados)',
                  description: 'Click en editar para modificar una actualización existente'
                },
                {
                  title: 'Eliminar (Abogados)',
                  description: 'Click en eliminar y confirma para remover la actualización'
                }
              ],
              restrictions: [
                'Solo los abogados pueden crear, editar y eliminar actualizaciones',
                'Los clientes y usuarios básicos solo pueden ver las actualizaciones activas'
              ],
              tips: [
                'Mantén las actualizaciones al día para informar a tus clientes',
                'Usa el estado inactivo para ocultar temporalmente una actualización sin eliminarla'
              ]
            },
            {
              id: 'reports',
              name: 'Generar Reportes',
              description: 'Exportar reportes de actividad en Excel',
              roles: ['lawyer'],
              content: `
                <p>Los abogados pueden generar reportes de actividad exportados en formato <strong>Excel</strong>, filtrados por rango de fechas.</p>
              `,
              features: [
                'Generar reporte de actividad en Excel',
                'Filtrar por rango de fechas (inicio y fin)',
                'Descarga automática del archivo',
                'Datos de procesos, documentos y actividad general'
              ],
              steps: [
                {
                  title: 'Accede a Reportes',
                  description: 'En el dashboard, click en el botón de reportes'
                },
                {
                  title: 'Selecciona Rango de Fechas',
                  description: 'Elige la fecha de inicio y fin del período a reportar'
                },
                {
                  title: 'Genera el Reporte',
                  description: 'Click en "Generar" para crear y descargar el archivo Excel'
                }
              ],
              tips: [
                'Genera reportes mensuales para llevar un control de actividad',
                'El archivo Excel incluye múltiples hojas con datos detallados',
                'Usa rangos de fecha cortos para reportes más específicos'
              ]
            }
          ]
        },

        directory: {
          name: 'Directorio',
          icon: UsersIcon,
          description: 'Listado completo de clientes y usuarios del sistema',
          overview: `
            <p>El Directorio es una funcionalidad exclusiva para abogados que permite buscar y consultar información de todos los usuarios del sistema.</p>
          `,
          sections: [
            {
              id: 'search-users',
              name: 'Búsqueda de Usuarios',
              description: 'Encuentra usuarios rápidamente',
              roles: ['lawyer'],
              content: `
                <p>Utiliza la barra de búsqueda para encontrar usuarios por nombre, email, identificación o rol.</p>
              `,
              features: [
                'Búsqueda en tiempo real',
                'Filtrado por múltiples campos',
                'Resultados instantáneos'
              ],
              steps: [
                {
                  title: 'Accede al Directorio',
                  description: 'Click en "Directorio" en el menú lateral'
                },
                {
                  title: 'Usa la barra de búsqueda',
                  description: 'Escribe el nombre, email o identificación del usuario'
                },
                {
                  title: 'Selecciona un usuario',
                  description: 'Click en el usuario para ver sus procesos asociados'
                }
              ]
            },
            {
              id: 'user-info',
              name: 'Información de Usuarios',
              description: 'Datos visibles de cada usuario',
              roles: ['lawyer'],
              content: `
                <p>Cada usuario en el directorio muestra información básica y su rol en el sistema.</p>
              `,
              features: [
                'Foto de perfil',
                'Nombre completo',
                'Rol (con badge de color)',
                'Email de contacto',
                'Click para ver procesos del usuario'
              ]
            },
            {
              id: 'user-detail-modal',
              name: 'Modal de Detalle de Usuario',
              description: 'Información completa y procesos del usuario',
              roles: ['lawyer'],
              content: `
                <p>Al hacer click en un usuario del directorio, ahora se abre un <strong>modal detallado</strong> en lugar de redirigir directamente a procesos.</p>
                <p class="mt-2">El modal muestra información del usuario y lista sus procesos asociados de forma resumida.</p>
              `,
              features: [
                'Modal con dos secciones: Información del Usuario y Procesos',
                'Avatar con iniciales si no hay foto',
                'Información completa: nombre, email, identificación, contacto, rol, fecha de nacimiento',
                'Lista de procesos del usuario con información resumida',
                'Botón "Ver proceso" para ir al detalle de cada caso',
                'Botón "Ver todos en Procesos" para lista completa filtrada',
                'Diseño responsive para móvil y escritorio',
                'Carga automática de procesos al abrir el modal'
              ],
              steps: [
                {
                  title: 'Accede al Directorio',
                  description: 'Click en "Directorio" en el menú lateral'
                },
                {
                  title: 'Busca Usuario',
                  description: 'Usa la barra de búsqueda o scroll para encontrar al usuario'
                },
                {
                  title: 'Click en Tarjeta',
                  description: 'Click en cualquier parte de la tarjeta del usuario'
                },
                {
                  title: 'Modal se Abre',
                  description: 'Aparece modal con información del usuario en la parte superior'
                },
                {
                  title: 'Sección de Información',
                  description: 'Revisa datos: nombre, email, identificación, contacto, rol, cumpleaños'
                },
                {
                  title: 'Sección de Procesos',
                  description: 'Scroll hacia abajo para ver lista de procesos del usuario'
                },
                {
                  title: 'Ver Proceso',
                  description: 'Click en "Ver proceso" para ir al detalle de un caso específico'
                },
                {
                  title: 'Ver Todos',
                  description: 'Click en "Ver todos en Procesos" para lista completa filtrada'
                }
              ],
              tips: [
                'El modal carga procesos automáticamente, puede tardar un momento',
                'Si el usuario no tiene procesos, se muestra un mensaje claro',
                'Puedes cerrar con X, botón Cerrar o click fuera del modal',
                'Útil para consultas rápidas sin navegar a otra página'
              ]
            }
          ]
        },

        processes: {
          name: 'Procesos',
          icon: FolderIcon,
          description: 'Gestión y consulta de procesos judiciales',
          overview: `
            <p>El módulo de Procesos te permite gestionar y consultar todos los casos judiciales de manera organizada y eficiente.</p>
            <p class="mt-2">Los procesos están organizados en <strong>3 pestañas principales</strong>:</p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li><strong>Mis Procesos:</strong> Casos donde eres parte o responsable</li>
              <li><strong>Todos los Procesos:</strong> Vista completa del sistema (solo abogados)</li>
              <li><strong>Procesos Archivados:</strong> Casos finalizados</li>
            </ul>
          `,
          sections: [
            {
              id: 'process-tabs',
              name: 'Pestañas de Procesos',
              description: 'Organización de procesos por categorías',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Los procesos están organizados en pestañas para facilitar su consulta y gestión.</p>
              `,
              features: [
                'Mis Procesos: Casos donde eres parte o responsable',
                'Todos los Procesos: Vista completa del sistema (SOLO ABOGADOS)',
                'Procesos Archivados: Casos finalizados e históricos'
              ],
              restrictions: [
                'Los clientes solo ven "Mis Procesos" y "Procesos Archivados"',
                'Solo los abogados pueden ver "Todos los Procesos"',
                'Los usuarios básicos no pueden solicitar información'
              ],
              example: {
                title: 'Ejemplo: Navegando por las Pestañas de Procesos',
                description: 'Aprende a usar las diferentes pestañas para organizar y consultar tus procesos judiciales.',
                steps: [
                  {
                    title: 'Accede al módulo de Procesos',
                    description: 'Click en "Procesos" en el menú lateral izquierdo',
                    note: 'Verás las pestañas disponibles según tu rol'
                  },
                  {
                    title: 'Pestaña "Mis Procesos"',
                    description: 'Muestra solo los procesos donde eres parte. Para abogados: casos asignados. Para clientes: casos propios.',
                    note: 'Esta es la vista predeterminada al entrar'
                  },
                  {
                    title: 'Pestaña "Todos los Procesos" (Solo Abogados)',
                    description: 'Vista completa de todos los procesos en el sistema para supervisión general',
                    note: 'Útil para coordinadores y supervisores'
                  },
                  {
                    title: 'Pestaña "Procesos Archivados"',
                    description: 'Histórico de casos finalizados. Útil para consultas y referencias',
                    note: 'Los procesos archivados son de solo lectura'
                  }
                ],
                tips: [
                  'Usa "Mis Procesos" para tu trabajo diario',
                  'Los abogados pueden usar "Todos los Procesos" para supervisión',
                  'Archiva procesos finalizados para mantener limpia tu vista principal'
                ]
              }
            },
            {
              id: 'filters-search',
              name: 'Filtros y Búsqueda',
              description: 'Encuentra procesos específicos rápidamente',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El sistema de filtros te permite encontrar procesos específicos de manera eficiente usando múltiples criterios.</p>
              `,
              features: [
                'Búsqueda por referencia, demandante, demandado, autoridad o cliente',
                'Filtro por Tipo de Caso (Civil, Penal, Laboral, etc.)',
                'Filtro por Autoridad (Juzgados, Tribunales, Cortes)',
                'Filtro por Etapa Procesal (Admisión, Pruebas, Alegatos, Sentencia)',
                'Botón "Limpiar" para resetear todos los filtros',
                'Ordenamiento por fecha (más recientes) o nombre (A-Z)',
                'Contador de resultados encontrados',
                'En la columna "Nombre" puedes usar el enlace "Ver usuarios" para consultar todos los clientes asociados a un proceso'
              ],
              steps: [
                {
                  title: 'Usa la barra de búsqueda',
                  description: 'Escribe cualquier término: referencia, nombre de parte, autoridad, etc.'
                },
                {
                  title: 'Aplica filtros específicos',
                  description: 'Selecciona tipo, autoridad o etapa desde los dropdowns'
                },
                {
                  title: 'Combina filtros',
                  description: 'Puedes usar búsqueda + filtros simultáneamente para mayor precisión'
                },
                {
                  title: 'Limpia filtros',
                  description: 'Click en "Limpiar" para resetear y volver a la vista completa'
                }
              ],
              tips: [
                'La búsqueda funciona en tiempo real, no necesitas presionar Enter',
                'Combina múltiples filtros para búsquedas muy específicas',
                'El contador te muestra cuántos procesos coinciden con tu búsqueda'
              ]
            },
            {
              id: 'create-process',
              name: 'Radicar Proceso (Solo Abogados)',
              description: 'Crear un nuevo proceso judicial',
              roles: ['lawyer'],
              content: `
                <p>Los abogados pueden crear nuevos procesos judiciales completando un formulario detallado con toda la información del caso.</p>
              `,
              features: [
                'Formulario completo con validación de campos',
                'Combobox con búsqueda para Tipo de Proceso',
                'Selección de uno o varios Clientes desde base de datos (multi-selección)',
                'Asignación de Abogado responsable',
                'Subida de múltiples archivos adjuntos',
                'Campos: Demandante, Demandado, Autoridad, Referencia, Subclase',
                'Definición de etapa procesal inicial',
                'Tabla con el listado de clientes seleccionados para revisar fácilmente las asociaciones del proceso'
              ],
              steps: [
                {
                  title: 'Click en "Radicar Proceso"',
                  description: 'Botón verde en la parte superior derecha de la lista de procesos'
                },
                {
                  title: 'Completa información básica',
                  description: 'Llena Demandante, Demandado, Autoridad y Referencia/Radicado'
                },
                {
                  title: 'Selecciona Tipo de Proceso',
                  description: 'Usa el combobox con búsqueda para encontrar el tipo correcto'
                },
                {
                  title: 'Asigna Cliente y Abogado',
                  description: 'Selecciona uno o varios clientes asociados y el abogado responsable del proceso'
                },
                {
                  title: 'Define Subclase y Etapa',
                  description: 'Especifica la subclase del proceso y la etapa procesal actual'
                },
                {
                  title: 'Adjunta archivos',
                  description: 'Sube documentos relacionados (demanda, poder, etc.)'
                },
                {
                  title: 'Guarda el proceso',
                  description: 'Click en "Guardar" para crear el proceso en el sistema'
                }
              ],
              restrictions: [
                'Solo los abogados pueden crear procesos',
                'Todos los campos marcados con * son obligatorios',
                'Los clientes NO tienen acceso a esta funcionalidad'
              ],
              tips: [
                'Usa el combobox de búsqueda para encontrar rápidamente el tipo de proceso',
                'Puedes subir múltiples archivos a la vez',
                'Asegúrate de asignar el cliente correcto para que pueda ver el proceso'
              ],
              example: {
                title: 'Ejemplo: Radicar un Proceso de Tutela',
                description: 'Paso a paso para crear un nuevo proceso de tutela en el sistema.',
                steps: [
                  {
                    title: 'Accede a Radicar Proceso',
                    description: 'Desde la lista de procesos, click en el botón verde "Radicar Proceso"'
                  },
                  {
                    title: 'Información de las Partes',
                    description: 'Demandante: "Juan Pérez García", Demandado: "EPS Salud Total"'
                  },
                  {
                    title: 'Tipo y Autoridad',
                    description: 'Tipo: "Tutela", Autoridad: "Juzgado 10 Civil Municipal de Bogotá"'
                  },
                  {
                    title: 'Referencia',
                    description: 'Radicado: "2024-00123", Subclase: "Derecho a la Salud"'
                  },
                  {
                    title: 'Asignaciones',
                    description: 'Clientes: Selecciona uno o varios clientes (por ejemplo, "Juan Pérez") de la lista. Abogado: Asigna el responsable del caso.'
                  },
                  {
                    title: 'Etapa y Archivos',
                    description: 'Etapa: "Admisión", Adjunta: demanda.pdf, poder.pdf, documentos_identidad.pdf'
                  },
                  {
                    title: 'Guardar',
                    description: 'Revisa toda la información y click en "Guardar"'
                  }
                ],
                tips: [
                  'Para tutelas, la etapa inicial suele ser "Admisión"',
                  'Adjunta siempre el poder y la demanda en el momento de radicar',
                  'El cliente recibirá notificación del nuevo proceso'
                ],
                commonErrors: [
                  'Olvidar adjuntar el poder - es un documento obligatorio',
                  'No asignar el cliente correcto - el cliente no podrá ver el proceso',
                  'Dejar campos obligatorios vacíos - el sistema no permitirá guardar'
                ]
              }
            },
            {
              id: 'process-detail',
              name: 'Detalle de Proceso',
              description: 'Información completa de un proceso',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El detalle del proceso muestra toda la información relevante y el historial completo del caso.</p>
              `,
              features: [
                'Información completa del caso',
                'Timeline visual de etapas con burbujas',
                'Expediente digital con tabla de archivos',
                'Búsqueda de documentos en el expediente',
                'Descarga individual de archivos',
                'Paginación de archivos (10 por página)',
                'Botón "Ver usuarios" para abrir un modal con todos los clientes asociados al proceso (foto o iniciales y nombre completo)',
                'Barra de progreso que refleja de forma continua el porcentaje de avance del proceso'
              ],
              tips: [
                'Usa la búsqueda del expediente para encontrar documentos específicos',
                'El timeline muestra visualmente el progreso del caso',
                'Si un proceso tiene varios clientes, utiliza "Ver usuarios" para confirmar todas las personas asociadas'
              ]
            },
            {
              id: 'request-info',
              name: 'Solicitar Información',
              description: 'Clientes pueden solicitar información sobre procesos',
              roles: ['client', 'corporate_client'],
              content: `
                <p>Los clientes pueden solicitar información adicional sobre sus procesos directamente desde el detalle.</p>
              `,
              features: [
                'Botón "Solicitar Información" en el detalle del proceso',
                'Formulario pre-llenado con información del proceso',
                'Envío directo al abogado responsable'
              ],
              steps: [
                {
                  title: 'Abre el detalle del proceso',
                  description: 'Click en el proceso que te interesa'
                },
                {
                  title: 'Click en "Solicitar Información"',
                  description: 'Botón visible en la parte superior'
                },
                {
                  title: 'Completa tu consulta',
                  description: 'Describe qué información necesitas'
                },
                {
                  title: 'Envía la solicitud',
                  description: 'El abogado recibirá tu consulta'
                }
              ]
            },
            {
              id: 'process-stages-management',
              name: 'Gestión de Etapas con Fechas',
              description: 'Control de fechas por etapa procesal',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Cada etapa del proceso cuenta ahora con una <strong>fecha explícita</strong> que puede ser definida por el abogado o usar la fecha actual por defecto.</p>
                <p class="mt-2">Esto permite mantener una línea de tiempo precisa del caso y facilita el seguimiento de actuaciones judiciales.</p>
              `,
              features: [
                'Fecha personalizable por cada etapa procesal',
                'Fecha automática (actual) si no se especifica',
                'Edición de fechas en cualquier momento',
                'Histórico ordenado cronológicamente',
                'Visualización clara de la línea de tiempo del caso',
                'Control preciso de vencimientos y plazos'
              ],
              steps: [
                {
                  title: 'Accede a Editar Proceso',
                  description: 'Desde la lista de procesos, click en el botón de editar del proceso'
                },
                {
                  title: 'Tabla de Etapas',
                  description: 'Verás una tabla con columnas: Descripción de Etapa y Fecha'
                },
                {
                  title: 'Define la Fecha',
                  description: 'Click en el campo de fecha y selecciona del calendario la fecha real de la etapa'
                },
                {
                  title: 'Fecha Automática',
                  description: 'Si no defines fecha, el sistema usará automáticamente la fecha actual'
                },
                {
                  title: 'Agregar Etapas',
                  description: 'Puedes agregar nuevas etapas con sus respectivas fechas'
                },
                {
                  title: 'Guardar Cambios',
                  description: 'Click en "Guardar" para actualizar el proceso con las fechas definidas'
                }
              ],
              tips: [
                'Define fechas reales de audiencias y actuaciones para mejor trazabilidad',
                'Puedes corregir fechas pasadas si fueron registradas incorrectamente',
                'El histórico procesal mostrará las etapas ordenadas por estas fechas',
                'Útil para calcular tiempos entre etapas y generar reportes'
              ],
              restrictions: [
                'Solo los abogados pueden editar fechas de etapas',
                'Los clientes solo pueden visualizar las fechas en el histórico'
              ],
              example: {
                title: 'Ejemplo: Ajustando Fechas de un Proceso de Tutela',
                description: 'Cómo registrar las fechas reales de cada etapa procesal.',
                steps: [
                  {
                    title: 'Proceso Creado',
                    description: 'Tienes un proceso de tutela con etapas: Admisión, Traslado, Fallo',
                    note: 'Inicialmente todas tienen la fecha de creación'
                  },
                  {
                    title: 'Editar Proceso',
                    description: 'Click en editar para acceder a la tabla de etapas'
                  },
                  {
                    title: 'Admisión - 12/10/2024',
                    description: 'Seleccionas la fecha real cuando se admitió la tutela'
                  },
                  {
                    title: 'Traslado - 15/10/2024',
                    description: 'Fecha cuando se corrió traslado a la entidad accionada'
                  },
                  {
                    title: 'Fallo - 30/10/2024',
                    description: 'Fecha de la sentencia del juez'
                  },
                  {
                    title: 'Guardar',
                    description: 'El histórico ahora muestra la cronología real del caso'
                  }
                ],
                tips: [
                  'Registra fechas apenas ocurran las actuaciones',
                  'Mantén un calendario de audiencias para no olvidar fechas',
                  'El cliente verá estas fechas en el histórico procesal'
                ]
              }
            },
            {
              id: 'process-detail-visual',
              name: 'Vista Optimizada del Detalle',
              description: 'Interfaz moderna con avatar y tarjetas',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El detalle del proceso ha sido completamente rediseñado con una <strong>interfaz visual moderna</strong> que facilita la consulta de información.</p>
                <p class="mt-2">Ahora incluye avatar del cliente, tarjetas organizadas y una barra de progreso visual tipo chevron.</p>
              `,
              features: [
                'Avatar circular con iniciales del cliente',
                'Encabezado con nombre completo y etiqueta de rol',
                'Dos tarjetas principales: Información del Proceso y Expediente',
                'Barra de progreso tipo chevron (Inicio → Etapa Actual → Fin)',
                'Porcentaje de avance del proceso',
                'Botón integrado "Histórico Procesal"',
                'Secciones organizadas: Oficina/Autoridad y Partes del Proceso',
                'Diseño responsive para móvil y escritorio'
              ],
              steps: [
                {
                  title: 'Abre el Detalle',
                  description: 'Click en cualquier proceso de la lista'
                },
                {
                  title: 'Encabezado Modernizado',
                  description: 'Verás el avatar del cliente a la izquierda con su nombre y rol'
                },
                {
                  title: 'Tarjeta de Información',
                  description: 'Primera tarjeta muestra tipo de proceso, autoridad, radicado y partes'
                },
                {
                  title: 'Barra de Progreso',
                  description: 'Visualiza el avance con flechas: Inicio → Etapa Actual → Fin'
                },
                {
                  title: 'Histórico Procesal',
                  description: 'Click en el botón para ver todas las etapas con sus fechas'
                },
                {
                  title: 'Tarjeta de Expediente',
                  description: 'Segunda tarjeta lista todos los documentos del caso'
                }
              ],
              tips: [
                'El avatar muestra las iniciales si no hay foto de perfil',
                'La barra de progreso da una idea visual rápida del avance',
                'El histórico procesal ahora muestra fechas reales de cada etapa'
              ]
            },
            {
              id: 'process-historical',
              name: 'Histórico Procesal Mejorado',
              description: 'Timeline con fechas reales por etapa',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El <strong>Histórico Procesal</strong> ahora muestra una línea de tiempo clara con las fechas reales de cada etapa del proceso.</p>
                <p class="mt-2">Las etapas se ordenan cronológicamente según las fechas definidas, no solo por orden de creación.</p>
              `,
              features: [
                'Modal amplio y legible',
                'Lista numerada de todas las etapas',
                'Fecha asociada a cada etapa (definida por usuario o automática)',
                'Etapas ordenadas por fecha (más recientes primero)',
                'Nombre descriptivo de cada etapa',
                'Sin elementos decorativos innecesarios',
                'Diseño centrado en la información'
              ],
              steps: [
                {
                  title: 'Abre el Detalle del Proceso',
                  description: 'Click en el proceso que quieres consultar'
                },
                {
                  title: 'Click en "Histórico Procesal"',
                  description: 'Botón integrado con la barra de progreso'
                },
                {
                  title: 'Visualiza la Línea de Tiempo',
                  description: 'Verás todas las etapas ordenadas cronológicamente'
                },
                {
                  title: 'Revisa Fechas',
                  description: 'Cada etapa muestra su fecha real de ocurrencia'
                },
                {
                  title: 'Cierra el Modal',
                  description: 'Click en X, botón Cerrar o fuera del modal'
                }
              ],
              tips: [
                'Útil para entender la duración real del proceso',
                'Permite identificar etapas que tomaron más tiempo',
                'Los clientes pueden ver cuándo ocurrió cada actuación'
              ],
              example: {
                title: 'Ejemplo: Consultando Histórico de Tutela',
                description: 'Cómo revisar la cronología completa de un caso.',
                steps: [
                  {
                    title: 'Abrir Proceso',
                    description: 'Cliente abre el detalle de su tutela'
                  },
                  {
                    title: 'Click en Histórico',
                    description: 'Botón visible en la barra de progreso'
                  },
                  {
                    title: 'Ver Etapas',
                    description: '1. Investigación - 12 oct 2024\n2. Alegatos - 15 ene 2025\n3. Pliego de Cargos - 06 jun 2025\n4. Fallo - 05 sept 2025'
                  },
                  {
                    title: 'Comprender Duración',
                    description: 'El cliente ve que el proceso duró casi un año'
                  }
                ]
              }
            },
            {
              id: 'edit-process',
              name: 'Editar Proceso',
              description: 'Modificar un proceso judicial existente',
              roles: ['lawyer'],
              content: `
                <p>Los abogados pueden editar procesos existentes para actualizar información, agregar etapas, modificar partes involucradas o actualizar archivos del expediente.</p>
              `,
              features: [
                'Precarga de todos los datos del proceso',
                'Modificar tipo de caso y subcaso',
                'Actualizar partes (demandante, demandado)',
                'Agregar o quitar clientes asociados',
                'Agregar nuevas etapas procesales con fecha',
                'Actualizar archivos del expediente',
                'Cambiar abogado responsable'
              ],
              steps: [
                {
                  title: 'Accede al Proceso',
                  description: 'Navega al detalle del proceso que deseas editar'
                },
                {
                  title: 'Click en "Editar"',
                  description: 'Botón disponible en la vista de detalle del proceso'
                },
                {
                  title: 'Modifica los Campos',
                  description: 'Actualiza la información necesaria (los datos existentes están precargados)'
                },
                {
                  title: 'Guarda los Cambios',
                  description: 'Click en "Guardar" para confirmar las modificaciones'
                }
              ],
              restrictions: [
                'Solo los abogados pueden editar procesos',
                'Los procesos archivados no pueden ser editados'
              ],
              tips: [
                'Revisa todos los campos antes de guardar para asegurarte de que la información es correcta',
                'Al agregar nuevas etapas, define la fecha real de ocurrencia',
                'Los cambios se reflejan inmediatamente en el detalle del proceso'
              ]
            },
            {
              id: 'case-file-upload',
              name: 'Expediente Digital',
              description: 'Subir y gestionar archivos del expediente',
              roles: ['lawyer'],
              content: `
                <p>El expediente digital permite subir y organizar todos los documentos relevantes de un proceso judicial. Los archivos se pueden buscar, descargar y paginar.</p>
              `,
              features: [
                'Upload múltiple de archivos',
                'Drag & drop para subir archivos',
                'Tabla de archivos con búsqueda',
                'Descarga individual de archivos',
                'Paginación (10 archivos por página)',
                'Tipos soportados: PDF, DOC, DOCX, JPG, PNG y más'
              ],
              steps: [
                {
                  title: 'Accede al Detalle del Proceso',
                  description: 'Navega al proceso donde quieres subir archivos'
                },
                {
                  title: 'Sección Expediente Digital',
                  description: 'Scroll hacia la tarjeta de expediente digital'
                },
                {
                  title: 'Sube Archivos',
                  description: 'Arrastra archivos al área de upload o click para seleccionar'
                },
                {
                  title: 'Busca Archivos',
                  description: 'Usa la barra de búsqueda para encontrar archivos específicos'
                },
                {
                  title: 'Descarga',
                  description: 'Click en el botón de descarga junto a cada archivo'
                }
              ],
              tips: [
                'Sube todos los documentos relevantes para tener un expediente completo',
                'Usa nombres descriptivos en los archivos para facilitar la búsqueda',
                'Los clientes pueden ver los archivos del expediente en el detalle del proceso'
              ]
            }
          ]
        },

        documents: {
          name: 'Archivos Jurídicos',
          icon: DocumentTextIcon,
          description: 'Gestión de documentos dinámicos, minutas y contratos',
          overview: `
            <p>El módulo de Archivos Jurídicos permite crear, gestionar y firmar documentos legales de manera digital.</p>
            <p class="mt-2"><strong>Para Abogados:</strong> 8 pestañas principales</p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li><strong>Minutas:</strong> Plantillas de documentos creadas (Published, Draft)</li>
              <li><strong>Mis Documentos:</strong> Documentos propios completados y en progreso</li>
              <li><strong>Carpetas:</strong> Organización de documentos en carpetas personalizadas</li>
              <li><strong>Documentos por Firmar:</strong> Pendientes de firma (PendingSignatures)</li>
              <li><strong>Documentos Firmados:</strong> Completamente firmados (FullySigned)</li>
              <li><strong>Documentos Archivados:</strong> Documentos rechazados o expirados (Rejected, Expired)</li>
              <li><strong>Documentos de Clientes (Completados):</strong> Finalizados por clientes</li>
              <li><strong>Documentos de Clientes (En Progreso):</strong> En proceso de completado</li>
            </ul>
            <p class="mt-2"><strong>Para Clientes:</strong> 5 pestañas principales</p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li><strong>Minutas:</strong> Plantillas disponibles para usar</li>
              <li><strong>Mis Documentos:</strong> Documentos asignados y completados</li>
              <li><strong>Carpetas:</strong> Documentos organizados por carpetas</li>
              <li><strong>Documentos por Firmar:</strong> Pendientes de firma</li>
              <li><strong>Documentos Firmados:</strong> Archivo final</li>
            </ul>
          `,
          sections: [
            {
              id: 'lawyer-tabs',
              name: 'Pestañas para Abogados',
              description: 'Organización de documentos por estado',
              roles: ['lawyer'],
              content: `
                <p>Los abogados tienen acceso a 8 pestañas para gestionar documentos en diferentes estados del flujo de trabajo.</p>
                <p class="mt-2"><strong>Nuevas pestañas agregadas:</strong></p>
                <ul class="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Mis Documentos:</strong> Similar a la vista de clientes, permite al abogado usar minutas para crear documentos propios y formalizarlos con firmas.</li>
                  <li><strong>Carpetas:</strong> Organizar documentos en carpetas personalizadas para mejor gestión.</li>
                </ul>
              `,
              features: [
                'Minutas: Crear y gestionar plantillas de documentos (solo plantillas)',
                'Mis Documentos: Usar minutas para crear documentos propios y formalizarlos',
                'Carpetas: Organizar documentos en carpetas personalizadas',
                'Por Firmar: Ver documentos pendientes de firma',
                'Firmados: Archivo de documentos completados',
                'Archivados: Documentos rechazados o expirados para referencia y corrección',
                'Completados por Clientes: Revisar información llenada',
                'En Progreso por Clientes: Ver avance de completado'
              ]
            },
            {
              id: 'document-actions',
              name: 'Acciones sobre Documentos',
              description: 'Todas las operaciones disponibles',
              roles: ['lawyer'],
              content: `
                <p>Cada documento tiene múltiples acciones disponibles según su estado.</p>
              `,
              features: [
                '👁️ Ver/Editar: Abrir el documento en el editor',
                '📋 Duplicar: Crear una copia del documento',
                '👤 Asignar a Cliente: Enviar documento a un cliente',
                '⚙️ Configurar Variables: Definir campos dinámicos',
                '🏷️ Gestionar Etiquetas: Organizar con tags',
                '🗑️ Eliminar: Borrar el documento (con confirmación)',
                '📄 Descargar PDF: Exportar versión final',
                '📁 Mover a Carpeta: Organizar en carpetas',
                '✍️ Firmar: Agregar firma electrónica',
                '👀 Vista Previa: Ver sin editar',
                '↩️ Editar y reenviar para firma (documentos rechazados): reabre documentos Rejected/Expired, permite corregirlos y volver a enviarlos al flujo de firmas',
                '✏️ Editar contenido de documentos completados por clientes: abre el editor de contenido protegiendo variables subrayadas en amarillo para que no puedan modificarse'
              ],
              example: {
                title: 'Ejemplo: Crear y Asignar una Minuta',
                description: 'Proceso completo desde la creación hasta la asignación a un cliente.',
                steps: [
                  {
                    title: 'Crear Nueva Minuta',
                    description: 'Click en "Nueva Minuta" en la barra superior',
                    note: 'Se abrirá el editor TinyMCE'
                  },
                  {
                    title: 'Escribir Contenido',
                    description: 'Redacta el documento usando el editor enriquecido',
                    note: 'Puedes dar formato, agregar tablas, listas, etc.'
                  },
                  {
                    title: 'Insertar Variables',
                    description: 'Usa la sintaxis {{nombreVariable}} para campos dinámicos',
                    note: 'Ejemplo: {{nombreCliente}}, {{fechaContrato}}, {{valorTotal}}'
                  },
                  {
                    title: 'Guardar como Borrador',
                    description: 'Click en "Guardar" - el documento queda en estado Draft'
                  },
                  {
                    title: 'Configurar Variables',
                    description: 'Click en ⚙️ Configurar Variables para definir tipo de campo',
                    note: 'Define si es texto, fecha, número, email, etc.'
                  },
                  {
                    title: 'Asignar a Cliente',
                    description: 'Click en 👤 Asignar, selecciona el cliente de la lista'
                  },
                  {
                    title: 'Cliente Completa',
                    description: 'El cliente recibe el documento y llena los campos variables'
                  }
                ],
                tips: [
                  'Usa variables para hacer plantillas reutilizables',
                  'Configura tooltips en las variables para guiar al cliente',
                  'Puedes duplicar documentos para crear nuevas versiones rápidamente'
                ],
                commonErrors: [
                  'Olvidar configurar las variables antes de asignar',
                  'No definir el tipo de campo correcto (texto vs número vs fecha)',
                  'Asignar sin revisar que todas las variables estén bien escritas'
                ]
              }
            },
            {
              id: 'formalize-from-my-documents',
              name: 'Formalizar Documentos (Abogados)',
              description: 'Crear documentos formales con firmas desde "Mis Documentos"',
              roles: ['lawyer'],
              content: `
                <p>Los abogados pueden usar minutas para crear documentos propios y formalizarlos con firmas electrónicas desde la pestaña "Mis Documentos".</p>
                <p class="mt-2"><strong>Importante:</strong> La opción "Formalizar y Agregar Firmas" ya NO está disponible en el menú de Minutas. Ahora solo aparece en "Mis Documentos" para documentos completados.</p>
              `,
              features: [
                'Usar minutas como plantillas para crear documentos propios',
                'Completar campos variables del documento',
                'Gestionar asociaciones con documentos ya firmados',
                'Agregar firmantes al documento',
                'Enviar documento para firma electrónica',
                'Seguimiento del estado de firmas'
              ],
              example: {
                title: 'Flujo Completo: Formalizar un Documento',
                description: 'Proceso paso a paso para crear y formalizar un documento desde "Mis Documentos".',
                steps: [
                  {
                    title: 'Ir a "Mis Documentos"',
                    description: 'Navega a la pestaña "Mis Documentos" en Archivos Jurídicos',
                    note: 'Esta pestaña funciona igual que para clientes'
                  },
                  {
                    title: 'Usar una Minuta',
                    description: 'Selecciona una minuta publicada y haz click en "Usar"',
                    note: 'Esto crea un documento nuevo basado en la plantilla'
                  },
                  {
                    title: 'Completar Campos',
                    description: 'Llena todos los campos variables del formulario',
                    note: 'Ejemplo: Nombre del cliente, Objeto del contrato, Valor, etc.'
                  },
                  {
                    title: 'Guardar como Completado',
                    description: 'Click en "Generar" para completar el documento',
                    note: 'El documento pasa a estado "Completed"'
                  },
                  {
                    title: 'Abrir Menú de Acciones',
                    description: 'En "Mis Documentos", click en el menú (⋮) del documento completado'
                  },
                  {
                    title: 'Formalizar y Agregar Firmas',
                    description: 'Selecciona la opción "Formalizar y Agregar Firmas"',
                    note: 'Esta opción SOLO aparece en documentos Completed'
                  },
                  {
                    title: 'Gestionar Asociaciones (Opcional)',
                    description: 'Click en "Gestionar asociaciones" para relacionar con documentos firmados',
                    note: 'Muestra dos tabs: "Documentos Relacionados" y "Relacionar Documentos"'
                  },
                  {
                    title: 'Agregar Firmantes',
                    description: 'Busca y selecciona los usuarios que deben firmar el documento',
                    note: 'Puedes agregar múltiples firmantes'
                  },
                  {
                    title: 'Publicar para Firmas',
                    description: 'Click en "Formalizar y Agregar Firmas" para enviar',
                    note: 'El documento pasa a estado "PendingSignatures"'
                  }
                ],
                tips: [
                  'Completa todos los campos antes de formalizar',
                  'Asocia documentos relacionados antes de enviar a firmar',
                  'Verifica que todos los firmantes sean correctos',
                  'El documento aparecerá en "Documentos por Firmar" después de formalizar'
                ],
                commonErrors: [
                  'Intentar formalizar desde "Minutas" (ya no disponible)',
                  'No completar todos los campos obligatorios',
                  'Olvidar agregar firmantes antes de publicar'
                ]
              }
            },
            {
              id: 'electronic-signature',
              name: 'Firma Electrónica',
              description: 'Sistema de firma digital con trazabilidad',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>La firma electrónica permite firmar documentos digitalmente con total trazabilidad legal.</p>
              `,
              features: [
                'Dibujar firma con mouse o touch',
                'Subir imagen de firma escaneada',
                'Guardar firma para uso futuro',
                'Trazabilidad completa: fecha, hora, IP, método',
                'Registro en actividad del usuario',
                'Ver progreso de firmas (X de Y firmadas)',
                'Múltiples firmantes en un documento',
                'Rechazo de documentos con comentario opcional de justificación',
                'Reapertura de documentos rechazados para corrección y nuevo envío a firma (solo abogados)'
              ],
              restrictions: [
                'NO disponible para usuarios básicos',
                'Requiere suscripción activa para clientes'
              ],
              steps: [
                {
                  title: 'Accede a Firma Electrónica',
                  description: 'Click en el botón "Firma" en la barra superior'
                },
                {
                  title: 'Elige método',
                  description: 'Dibujar con mouse/touch o subir imagen'
                },
                {
                  title: 'Crea tu firma',
                  description: 'Dibuja o selecciona el archivo de imagen'
                },
                {
                  title: 'Guarda la firma',
                  description: 'Click en "Guardar" para almacenar'
                },
                {
                  title: 'Firma documentos',
                  description: 'Usa la firma guardada en cualquier documento'
                }
              ]
            },
            {
              id: 'letterhead',
              name: 'Membrete Global',
              description: 'Configuración de encabezado y pie de página',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>El membrete global permite configurar un encabezado y pie de página que se aplica automáticamente a todos los documentos nuevos.</p>
              `,
              features: [
                'Subir logo o imagen de encabezado',
                'Configurar texto de encabezado',
                'Configurar pie de página',
                'Vista previa en tiempo real',
                'Aplicar a todos los documentos nuevos',
                'Guardar como predeterminado'
              ],
              restrictions: [
                'NO disponible para usuarios básicos'
              ]
            },
            {
              id: 'folders',
              name: 'Sistema de Carpetas',
              description: 'Organización jerárquica de documentos',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Las carpetas permiten organizar documentos de manera jerárquica para mejor gestión.</p>
              `,
              features: [
                'Crear carpetas personalizadas',
                'Mover documentos entre carpetas',
                'Agregar múltiples documentos a una carpeta',
                'Ver contenido de carpeta en grid o tabla',
                'Editar nombre y descripción de carpeta',
                'Eliminar carpetas (con confirmación)',
                'Búsqueda dentro de carpetas'
              ]
            },
            {
              id: 'tags',
              name: 'Sistema de Etiquetas',
              description: 'Organización con tags de colores',
              roles: ['lawyer'],
              content: `
                <p>Las etiquetas permiten categorizar y filtrar documentos de manera visual.</p>
              `,
              features: [
                'Crear etiquetas personalizadas',
                'Asignar colores de una paleta predefinida',
                'Filtrar documentos por etiquetas',
                'Múltiples etiquetas por documento',
                'Editar y eliminar etiquetas',
                'Ejemplos: Contratos, Poderes, Demandas, Tutelas, Actas'
              ]
            },
            {
              id: 'client-use-document',
              name: 'Usar Documento (Clientes)',
              description: 'Completar plantillas asignadas',
              roles: ['client', 'corporate_client'],
              content: `
                <p>Los clientes pueden completar documentos asignados por abogados llenando campos variables.</p>
              `,
              features: [
                'Ver lista de documentos asignados',
                'Formulario con campos variables',
                'Tooltips explicativos por campo',
                'Validación en tiempo real',
                'Guardar progreso (borrador)',
                'Enviar completado al abogado',
                'Indicadores de campos obligatorios',
                'Editar contenido de documentos completados sin modificar variables protegidas (subrayadas en amarillo)'
              ],
              steps: [
                {
                  title: 'Accede a "Usar Documento"',
                  description: 'Pestaña en Archivos Jurídicos'
                },
                {
                  title: 'Selecciona documento',
                  description: 'Click en el documento asignado'
                },
                {
                  title: 'Completa campos',
                  description: 'Llena todos los campos variables del formulario'
                },
                {
                  title: 'Revisa tooltips',
                  description: 'Lee las ayudas para entender qué información ingresar'
                },
                {
                  title: 'Guarda progreso',
                  description: 'Puedes guardar y continuar después'
                },
                {
                  title: 'Envía completado',
                  description: 'Cuando termines, envía al abogado para revisión'
                }
              ]
            },
            {
              id: 'document-relationships',
              name: 'Asociación de Documentos',
              description: 'Vincular documentos relacionados entre sí',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>La funcionalidad de <strong>Asociación de Documentos</strong> permite vincular documentos jurídicos relacionados para mantener trazabilidad completa.</p>
                <p class="mt-2">Puedes asociar contratos con anexos, adendas con contratos originales, y cualquier relación documental relevante.</p>
                <p class="mt-2"><strong>Importante:</strong> Las Minutas (documentos en estado Borrador o Publicado) NO pueden gestionar asociaciones. Solo los documentos completados o firmados pueden vincularse entre sí.</p>
              `,
              features: [
                'Columna "Docs. Asociados" visible solo en documentos que pueden asociarse',
                'Botón "Ver asociaciones (N)" muestra contador de documentos vinculados',
                'Botón deshabilitado con texto "Sin asociaciones" cuando no hay vínculos',
                'Modal de gestión con dos pestañas: Documentos Relacionados y Relacionar Documentos',
                'Búsqueda de documentos dentro del modal',
                'Previsualización de documentos asociados con variables reemplazadas',
                'Modo editable (documentos Completados) y solo lectura (documentos en firma)',
                'Asociaciones inmutables una vez el documento entra en flujo de firma',
                'Ordenamiento por fecha de actualización (más recientes primero)',
                'Filtrado automático: solo se muestran documentos Completados para asociar'
              ],
              steps: [
                {
                  title: 'Ubicar la Columna',
                  description: 'En cualquier tabla de documentos, verás la columna "Docs. Asociados"'
                },
                {
                  title: 'Click en "Ver asociaciones"',
                  description: 'Abre el modal de gestión de asociaciones'
                },
                {
                  title: 'Pestaña "Documentos Relacionados"',
                  description: 'Muestra los documentos ya vinculados con opciones para ver y desrelacionar'
                },
                {
                  title: 'Pestaña "Relacionar Documentos"',
                  description: 'Lista documentos disponibles para asociar con botón "Relacionar"'
                },
                {
                  title: 'Buscar Documentos',
                  description: 'Usa la barra de búsqueda en cada pestaña para filtrar'
                },
                {
                  title: 'Crear Asociación',
                  description: 'Click en "Relacionar" junto al documento que quieres vincular'
                },
                {
                  title: 'Eliminar Asociación',
                  description: 'Click en "Desrelacionar" si necesitas quitar una vinculación (solo antes de firma)'
                }
              ],
              restrictions: [
                '<strong>Minutas (Borrador/Publicado):</strong> NO tienen columna de asociaciones ni opción en el menú',
                '<strong>Documentos en Progreso:</strong> El botón está deshabilitado hasta completar el documento',
                '<strong>Solo documentos Completados:</strong> En "Mis Documentos", solo puedes relacionar documentos en estado "Completado"',
                '<strong>Documentos en firma:</strong> Las asociaciones son de solo lectura (no se pueden editar ni eliminar)',
                '<strong>Documentos firmados:</strong> En contextos de firma, solo se muestran documentos "Firmados Completamente" para asociar',
                '<strong>Sin asociaciones:</strong> El botón muestra "Sin asociaciones" y está deshabilitado cuando no hay vínculos',
                'NO disponible para usuarios básicos'
              ],
              tips: [
                'Las Minutas (Borrador/Publicado) NO pueden asociarse - completa el documento primero',
                'En "Mis Documentos", solo verás documentos Completados disponibles para relacionar',
                'Asocia documentos ANTES de enviar a firma, después ya no podrás editar',
                'El botón muestra el contador (N) solo cuando hay asociaciones',
                'Si el botón está gris y dice "Sin asociaciones", no hay documentos vinculados',
                'Los documentos se ordenan por fecha de actualización (más recientes primero)',
                'Usa asociaciones para vincular contratos marco con contratos específicos',
                'Los firmantes pueden ver documentos asociados antes de firmar'
              ],
              example: {
                title: 'Ejemplo: Asociar Anexos a un Contrato',
                description: 'Cómo vincular documentos complementarios antes de enviar a firma.',
                steps: [
                  {
                    title: 'Crear Contrato',
                    description: 'Abogado crea "Contrato de Servicios" y lo completa'
                  },
                  {
                    title: 'Formalizar',
                    description: 'Click en "Formalizar y Agregar Firmas"'
                  },
                  {
                    title: 'Gestionar Asociaciones',
                    description: 'En la sección "Asociaciones de documentos", click en "Gestionar asociaciones"'
                  },
                  {
                    title: 'Ver Disponibles',
                    description: 'El modal muestra solo documentos Completados: "Anexo Técnico", "Contrato Marco"'
                  },
                  {
                    title: 'Relacionar',
                    description: 'Click en "Relacionar" junto a "Anexo Técnico" y "Contrato Marco"'
                  },
                  {
                    title: 'Verificar',
                    description: 'El contador muestra "2 documentos asociados"'
                  },
                  {
                    title: 'Enviar a Firma',
                    description: 'Define firmantes y envía. Las asociaciones quedan bloqueadas'
                  },
                  {
                    title: 'Cliente Revisa',
                    description: 'El cliente puede ver los documentos asociados antes de firmar'
                  }
                ],
                tips: [
                  'Asocia todos los documentos relevantes antes de enviar a firma',
                  'Los firmantes agradecerán tener contexto completo',
                  'Después de firmado, las asociaciones quedan como registro histórico'
                ],
                commonErrors: [
                  'Intentar asociar Minutas (Borrador/Publicado) - no tienen esta opción',
                  'Buscar documentos en Progreso en el modal - solo se muestran Completados',
                  'Olvidar asociar antes de enviar a firma (después ya no se puede editar)',
                  'No revisar las asociaciones desde la perspectiva del firmante',
                  'Confundir "Sin asociaciones" (botón deshabilitado) con un error del sistema'
                ]
              }
            },
            {
              id: 'document-rejection-expiration',
              name: 'Rechazo y Expiración de Documentos',
              description: 'Gestión de documentos rechazados y expirados',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Los documentos enviados para firma ahora pueden ser <strong>rechazados</strong> por los firmantes o <strong>expirar</strong> automáticamente si superan la fecha límite.</p>
                <p class="mt-2">Todos los documentos rechazados y expirados se agrupan en una nueva pestaña "Documentos Archivados".</p>
              `,
              features: [
                'Opción "Rechazar documento" para firmantes',
                'Modal de rechazo con campo de motivo opcional',
                'Expiración automática según fecha límite definida',
                'Nueva pestaña "Documentos Archivados" (Rechazados y Expirados)',
                'Visualización del motivo de rechazo',
                'Identificación clara de documentos expirados',
                'Estados: Pendiente, Firmado, Rechazado, Expirado',
                'Trazabilidad completa en el panel de actividad'
              ],
              steps: [
                {
                  title: 'Recibir Documento para Firma',
                  description: 'El documento aparece en "Documentos por Firmar"'
                },
                {
                  title: 'Revisar Documento',
                  description: 'Abre el documento y revisa su contenido'
                },
                {
                  title: 'Decidir Acción',
                  description: 'Puedes elegir "Firmar documento" o "Rechazar documento"'
                },
                {
                  title: 'Rechazar (Opcional)',
                  description: 'Click en "Rechazar documento" abre un modal de confirmación'
                },
                {
                  title: 'Agregar Motivo',
                  description: 'Escribe el motivo del rechazo (opcional pero recomendado)'
                },
                {
                  title: 'Confirmar Rechazo',
                  description: 'El documento se mueve a "Documentos Archivados"'
                },
                {
                  title: 'Abogado Recibe Notificación',
                  description: 'El abogado ve el motivo y puede ajustar el documento'
                }
              ],
              restrictions: [
                'Solo los firmantes pueden rechazar documentos',
                'Los documentos rechazados no pueden volver a "Por Firmar" automáticamente',
                'Los documentos expirados no pueden firmarse',
                'NO disponible para usuarios básicos'
              ],
              tips: [
                'Sé específico en el motivo del rechazo para facilitar ajustes',
                'Revisa bien antes de rechazar, el proceso debe reiniciarse',
                'Los abogados pueden definir fechas límite realistas para evitar expiraciones',
                'Consulta "Documentos Archivados" para ver histórico de rechazos'
              ],
              example: {
                title: 'Ejemplo: Cliente Rechaza un Contrato',
                description: 'Flujo completo de rechazo con motivo.',
                steps: [
                  {
                    title: 'Documento Recibido',
                    description: 'Cliente ve "Contrato de Servicios" en "Por Firmar"'
                  },
                  {
                    title: 'Revisar',
                    description: 'Abre el documento y nota que falta una cláusula importante'
                  },
                  {
                    title: 'Rechazar',
                    description: 'Click en "Rechazar documento"'
                  },
                  {
                    title: 'Motivo',
                    description: 'Escribe: "Falta cláusula de confidencialidad acordada en reunión"'
                  },
                  {
                    title: 'Confirmar',
                    description: 'El documento se mueve a "Archivados"'
                  },
                  {
                    title: 'Abogado Ajusta',
                    description: 'El abogado recibe el motivo, agrega la cláusula y reenvía'
                  },
                  {
                    title: 'Nuevo Envío',
                    description: 'Cliente recibe el documento corregido para firma'
                  }
                ],
                tips: [
                  'Un motivo claro acelera las correcciones',
                  'Puedes rechazar múltiples veces si es necesario',
                  'El histórico de rechazos queda registrado'
                ]
              }
            },
            {
              id: 'document-key-fields',
              name: 'Clasificación de Campos Clave',
              description: 'Información esencial visible sin abrir documentos',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Los abogados pueden marcar ciertos campos como <strong>"información clave"</strong> para que se muestren en un modal organizado sin necesidad de abrir el documento completo.</p>
                <p class="mt-2">Esto incluye: Usuario/Contraparte, Objeto, Valor, Plazo y Fechas importantes.</p>
              `,
              features: [
                'Nueva columna "Información clave" en tablas de documentos',
                'Botón "Ver detalle" cuando hay información clasificada',
                'Modal con información estructurada y formato profesional',
                'Valores monetarios con símbolo de moneda y separadores de miles',
                'Fechas formateadas claramente',
                'Solo se muestran campos que contienen información',
                'Tres formas de cerrar: X, botón Cerrar, click fuera',
                'Diseño adaptable a móvil y escritorio'
              ],
              steps: [
                {
                  title: 'Crear/Editar Minuta (Abogado)',
                  description: 'Al definir variables, marca las que son "información clave"'
                },
                {
                  title: 'Tipos de Información Clave',
                  description: 'Usuario/Contraparte, Objeto, Valor (con moneda), Plazo, Fechas'
                },
                {
                  title: 'Cliente Completa',
                  description: 'El cliente llena el formulario normalmente'
                },
                {
                  title: 'Ver en Tabla',
                  description: 'En "Mis Documentos", aparece botón "Ver detalle"'
                },
                {
                  title: 'Abrir Modal',
                  description: 'Click en "Ver detalle" muestra la información organizada'
                },
                {
                  title: 'Consulta Rápida',
                  description: 'Revisa contraparte, valor, fechas sin abrir el documento'
                }
              ],
              restrictions: [
                'Solo los abogados pueden definir qué campos son "información clave"',
                'Solo un campo por tipo (un solo valor, un solo plazo, etc.)',
                'NO disponible para usuarios básicos'
              ],
              tips: [
                'Marca como clave la información que consultas frecuentemente',
                'Útil para contratos con valores, fechas de vencimiento, contrapartes',
                'Ahorra tiempo al revisar múltiples documentos',
                'Los clientes también se benefician de esta vista rápida'
              ],
              example: {
                title: 'Ejemplo: Contrato con Información Clave',
                description: 'Cómo definir y consultar información esencial.',
                steps: [
                  {
                    title: 'Abogado Crea Minuta',
                    description: 'Crea plantilla de "Contrato de Arrendamiento"'
                  },
                  {
                    title: 'Define Variables Clave',
                    description: 'Marca: Arrendatario (Usuario), Inmueble (Objeto), Canon (Valor en COP), Duración (Plazo), Inicio/Fin (Fechas)'
                  },
                  {
                    title: 'Asigna a Cliente',
                    description: 'Cliente completa: Arrendatario: "María Gómez", Canon: $2.500.000 COP, Duración: 12 meses'
                  },
                  {
                    title: 'Cliente Consulta',
                    description: 'En "Mis Documentos", click en "Ver detalle"'
                  },
                  {
                    title: 'Modal Muestra',
                    description: 'Usuario: María Gómez\nObjeto: Apartamento Calle 123\nValor: $2.500.000 COP\nPlazo: 12 meses\nInicio: 01/01/2025\nFin: 31/12/2025'
                  },
                  {
                    title: 'Consulta Rápida',
                    description: 'Cliente verifica fecha de vencimiento sin abrir el documento'
                  }
                ],
                tips: [
                  'Ideal para contratos de arrendamiento, compraventa, servicios',
                  'Facilita control de vencimientos y renovaciones',
                  'Útil para reportes corporativos'
                ]
              }
            },
            {
              id: 'document-form-modes',
              name: 'Modos del Formulario de Documentos',
              description: 'Los 4 modos de uso de un documento según el contexto',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Al abrir un documento para completar o gestionar, el formulario se adapta según el <strong>modo de uso</strong>. Cada modo tiene botones, secciones y acciones diferentes.</p>
              `,
              features: [
                'Modo Creator: crear documento nuevo desde plantilla',
                'Modo Editor: editar borrador existente',
                'Modo Formalize: agregar firmas y fecha límite',
                'Modo Correction: corregir documento rechazado o expirado'
              ],
              steps: [
                {
                  title: 'Modo Creator (Nuevo)',
                  description: 'Selecciona una plantilla publicada → llena los campos → "Guardar progreso" o "Generar"'
                },
                {
                  title: 'Modo Editor (Borrador)',
                  description: 'Abre un documento en progreso → modifica campos → "Guardar cambios como Borrador" o "Completar y Generar"'
                },
                {
                  title: 'Modo Formalize (Firmas)',
                  description: 'Documento completado → selecciona firmantes + fecha límite → "Formalizar y Agregar Firmas"'
                },
                {
                  title: 'Modo Correction (Corrección)',
                  description: 'Documento rechazado/expirado → corrige campos → "Guardar y reenviar para firma"'
                }
              ],
              restrictions: [
                'Solo abogados pueden formalizar documentos (agregar firmas)',
                'El modo Correction solo está disponible para documentos Rechazados o Expirados',
                'Los clientes solo pueden usar los modos Creator y Editor'
              ],
              tips: [
                'Guarda progreso frecuentemente para no perder cambios',
                'Define una fecha límite realista al formalizar para evitar expiraciones',
                'Al corregir un documento rechazado, revisa el motivo de rechazo antes de reenviar'
              ]
            },
            {
              id: 'document-field-types',
              name: 'Tipos de Campo en Documentos',
              description: 'Los 6 tipos de campo variable disponibles en formularios',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Los documentos tienen campos variables que se llenan al completar un formulario. Cada variable tiene un <strong>tipo de campo</strong> que determina cómo se ingresa la información.</p>
              `,
              features: [
                'Texto simple (input): para nombres, referencias cortas',
                'Área de texto (text_area): para descripciones largas',
                'Número (number): con formato de miles y moneda opcional (COP, USD, EUR)',
                'Fecha (date): selector de calendario',
                'Email (email): con validación de formato',
                'Selector (select): dropdown con opciones personalizadas'
              ],
              steps: [
                {
                  title: 'Identifica el tipo',
                  description: 'Cada campo muestra su tipo visualmente: input de texto, área expandida, calendario, etc.'
                },
                {
                  title: 'Completa según el tipo',
                  description: 'Ingresa la información respetando el formato esperado (texto, número, fecha, email)'
                },
                {
                  title: 'Valida antes de enviar',
                  description: 'El sistema valida automáticamente el formato de cada campo (ej: email válido, fecha correcta)'
                }
              ],
              tips: [
                'Los campos de tipo número con moneda muestran el símbolo automáticamente (ej: $ 2.500.000 COP)',
                'Los campos de tipo selector tienen opciones predefinidas por el abogado',
                'Los campos de tipo fecha abren un calendario para facilitar la selección'
              ]
            },
            {
              id: 'send-email',
              name: 'Enviar Documento por Email',
              description: 'Enviar un documento a una dirección de correo electrónico',
              roles: ['lawyer'],
              content: `
                <p>Los abogados pueden enviar documentos directamente por email a cualquier destinatario, incluyendo la opción de adjuntar archivos adicionales.</p>
              `,
              features: [
                'Enviar documento a cualquier email',
                'Adjuntar archivos adicionales al envío',
                'El documento se envía como archivo adjunto',
                'Confirmación de envío exitoso'
              ],
              steps: [
                {
                  title: 'Selecciona el Documento',
                  description: 'En el menú de acciones del documento, click en "Enviar por email"'
                },
                {
                  title: 'Ingresa el Email',
                  description: 'Escribe la dirección de correo del destinatario'
                },
                {
                  title: 'Adjunta Archivos (opcional)',
                  description: 'Agrega archivos adicionales si es necesario'
                },
                {
                  title: 'Envía',
                  description: 'Click en "Enviar" para completar el envío'
                }
              ],
              tips: [
                'Verifica la dirección de email antes de enviar',
                'Usa esta función para enviar documentos a contrapartes o terceros',
                'Los archivos adjuntos deben ser menores a 30MB'
              ]
            },
            {
              id: 'download-export',
              name: 'Descargar Documento',
              description: 'Exportar documentos como PDF o Word',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Puedes descargar documentos completados o firmados en formato <strong>PDF</strong> o <strong>Word</strong> para uso fuera de la plataforma.</p>
              `,
              features: [
                'Descarga directa en formato PDF',
                'Descarga directa en formato Word (DOCX)',
                'Descarga mediante blob (sin pantalla en blanco)',
                'Notificación de éxito o error',
                'Funciona en escritorio, tablet y móvil (PWA)'
              ],
              steps: [
                {
                  title: 'Ubica el Documento',
                  description: 'Navega al documento que deseas descargar'
                },
                {
                  title: 'Click en "Descargar"',
                  description: 'En el menú de acciones, selecciona "Descargar PDF" o "Descargar Word"'
                },
                {
                  title: 'Descarga Automática',
                  description: 'El archivo se descarga a tu dispositivo sin abrir nueva pestaña'
                }
              ],
              tips: [
                'El PDF incluye el membrete si está configurado',
                'La descarga funciona igual en la app móvil (PWA)',
                'Busca el archivo en tu carpeta de descargas si no lo ves inmediatamente'
              ]
            },
            {
              id: 'document-lifecycle',
              name: 'Ciclo de Vida del Documento',
              description: 'Estados y transiciones de un documento',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Un documento pasa por varios <strong>estados</strong> desde su creación hasta su firma final. Cada estado determina qué acciones están disponibles.</p>
                <p class="mt-2"><strong>Diagrama:</strong> Borrador → Publicado → En Progreso → Completado → Pendiente de Firmas → Firmado Completamente</p>
                <p class="mt-2">Los documentos también pueden ser <strong>Rechazados</strong> o <strong>Expirados</strong>, pasando a Documentos Archivados.</p>
              `,
              features: [
                'Estado Borrador (Draft): minuta en edición por el abogado',
                'Estado Publicado (Published): plantilla disponible para clientes',
                'Estado En Progreso (Progress): cliente está llenando el formulario',
                'Estado Completado (Completed): formulario llenado, listo para firma',
                'Estado Pendiente de Firmas (PendingSignatures): esperando firmantes',
                'Estado Firmado Completamente (FullySigned): todos los firmantes firmaron',
                'Estado Rechazado (Rejected): un firmante rechazó el documento',
                'Estado Expirado (Expired): se superó la fecha límite de firma'
              ],
              steps: [
                {
                  title: 'Borrador → Publicado',
                  description: 'El abogado publica la minuta para que esté disponible para clientes'
                },
                {
                  title: 'Publicado → En Progreso',
                  description: 'Un cliente selecciona la plantilla y comienza a llenar'
                },
                {
                  title: 'En Progreso → Completado',
                  description: 'El cliente finaliza y genera el documento'
                },
                {
                  title: 'Completado → Pendiente de Firmas',
                  description: 'El abogado formaliza con firmantes y fecha límite'
                },
                {
                  title: 'Pendiente → Firmado / Rechazado / Expirado',
                  description: 'Todos firman (Firmado), alguien rechaza (Rechazado) o vence la fecha (Expirado)'
                },
                {
                  title: 'Rechazado/Expirado → Pendiente (corrección)',
                  description: 'El abogado corrige y reenvía para firma'
                }
              ],
              tips: [
                'Un documento solo puede avanzar al siguiente estado, no retroceder (excepto corrección)',
                'Los documentos Rechazados y Expirados se encuentran en la pestaña "Documentos Archivados"',
                'Define fechas límite realistas para evitar expiraciones innecesarias',
                'Revisa el motivo de rechazo antes de corregir y reenviar'
              ]
            }
          ]
        },

        requests: {
          name: 'Solicitudes Legales',
          icon: InboxArrowDownIcon,
          description: 'Gestión de solicitudes y consultas legales',
          overview: `
            <p>El módulo de Solicitudes permite a los clientes solicitar servicios legales y a los abogados gestionar estas solicitudes.</p>
            <p class="mt-2">Los clientes pueden crear solicitudes que son gestionadas por abogados con un sistema de thread de conversación.</p>
          `,
          sections: [
            {
              id: 'create-request',
              name: 'Crear Solicitud (Clientes)',
              description: 'Enviar una nueva consulta legal',
              roles: ['client', 'corporate_client', 'basic'],
              content: `
                <p>Los clientes pueden crear solicitudes legales para consultas, asesorías o servicios.</p>
              `,
              features: [
                'Formulario completo con tipo y disciplina',
                'Descripción detallada de la solicitud',
                'Adjuntar múltiples archivos (PDF, DOC, DOCX, JPG, PNG)',
                'Número de solicitud automático (SOL-YYYY-NNN)',
                'Notificación automática al abogado',
                'Estados: Pendiente, En Revisión, Respondida, Cerrada'
              ],
              steps: [
                {
                  title: 'Accede a Solicitudes',
                  description: 'Click en "Solicitudes" en el menú lateral'
                },
                {
                  title: 'Click en "Nueva Solicitud"',
                  description: 'Botón en la parte superior de la lista'
                },
                {
                  title: 'Selecciona Tipo',
                  description: 'Elige el tipo de solicitud (Consulta, Asesoría, Revisión, Representación)'
                },
                {
                  title: 'Selecciona Disciplina',
                  description: 'Elige la disciplina legal (Civil, Penal, Laboral, Familia, etc.)'
                },
                {
                  title: 'Describe tu solicitud',
                  description: 'Explica detalladamente qué necesitas (mínimo 50 caracteres)'
                },
                {
                  title: 'Adjunta archivos',
                  description: 'Sube documentos relacionados si los tienes'
                },
                {
                  title: 'Envía la solicitud',
                  description: 'Recibirás un número de solicitud para seguimiento'
                }
              ],
              tips: [
                'Sé específico en la descripción para recibir mejor ayuda',
                'Adjunta todos los documentos relevantes desde el inicio',
                'Guarda el número de solicitud para futuras consultas'
              ]
            },
            {
              id: 'manage-requests',
              name: 'Gestionar Solicitudes (Abogados)',
              description: 'Administrar solicitudes recibidas',
              roles: ['lawyer'],
              content: `
                <p>Los abogados pueden ver, responder y gestionar todas las solicitudes recibidas de clientes.</p>
              `,
              features: [
                'Ver todas las solicitudes del sistema',
                'Filtrar por estado (Pendiente, En Revisión, Respondida, Cerrada)',
                'Filtrar por rango de fechas',
                'Cambiar estado de solicitud',
                'Thread de conversación completo',
                'Responder con mensajes',
                'Eliminar solicitudes',
                'Descargar archivos adjuntos',
                'Ver información completa del cliente'
              ],
              steps: [
                {
                  title: 'Accede a Gestión de Solicitudes',
                  description: 'Click en "Gestión de Solicitudes" en el menú'
                },
                {
                  title: 'Revisa solicitudes pendientes',
                  description: 'Filtra por estado "Pendiente" para ver nuevas solicitudes'
                },
                {
                  title: 'Abre el detalle',
                  description: 'Click en una solicitud para ver información completa'
                },
                {
                  title: 'Cambia el estado',
                  description: 'Marca como "En Revisión" cuando empieces a trabajar'
                },
                {
                  title: 'Responde al cliente',
                  description: 'Usa el formulario de respuesta para comunicarte'
                },
                {
                  title: 'Marca como Respondida',
                  description: 'Cambia el estado cuando hayas dado respuesta'
                },
                {
                  title: 'Cierra la solicitud',
                  description: 'Marca como "Cerrada" cuando el caso esté resuelto'
                }
              ],
              tips: [
                'Responde rápidamente para mejor servicio al cliente',
                'Usa el thread de conversación para mantener historial',
                'Descarga los archivos adjuntos antes de responder'
              ]
            },
            {
              id: 'request-thread',
              name: 'Thread de Conversación',
              description: 'Sistema de mensajería bidireccional',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>El thread permite mantener una conversación organizada entre cliente y abogado sobre la solicitud.</p>
              `,
              features: [
                'Mensajes ordenados cronológicamente',
                'Indicador de quién escribió (Cliente/Abogado)',
                'Fecha y hora de cada mensaje',
                'Agregar archivos adicionales',
                'Historial completo de la conversación'
              ]
            }
          ]
        },

        appointments: {
          name: 'Agendar Cita',
          icon: CalendarDaysIcon,
          description: 'Sistema de agendamiento de citas con abogados',
          overview: `
            <p>Integración con Calendly para agendar citas de asesoría legal de manera fácil y rápida.</p>
          `,
          sections: [
            {
              id: 'schedule',
              name: 'Agendar Cita',
              description: 'Proceso de agendamiento',
              roles: ['client', 'corporate_client', 'basic'],
              content: `
                <p>Los clientes pueden agendar citas con abogados usando el sistema Calendly integrado.</p>
              `,
              features: [
                'Calendario interactivo con disponibilidad en tiempo real',
                'Selección de fecha y hora',
                'Tipos de cita: Consulta inicial, Asesoría, Seguimiento, Revisión',
                'Formulario con datos de contacto',
                'Confirmación automática por email',
                'Agregar a calendario personal (Google, Outlook, iCal)',
                'Recordatorios automáticos'
              ],
              steps: [
                {
                  title: 'Accede a Agendar Cita',
                  description: 'Click en "Agendar Cita" en el menú lateral'
                },
                {
                  title: 'Selecciona tipo de cita',
                  description: 'Elige el tipo de consulta que necesitas'
                },
                {
                  title: 'Elige fecha y hora',
                  description: 'Selecciona del calendario según disponibilidad'
                },
                {
                  title: 'Completa tus datos',
                  description: 'Nombre, email, teléfono y motivo de la consulta'
                },
                {
                  title: 'Confirma la cita',
                  description: 'Revisa la información y confirma'
                },
                {
                  title: 'Recibe confirmación',
                  description: 'Recibirás un email con los detalles y enlace al calendario'
                }
              ],
              tips: [
                'Agenda con anticipación para mejor disponibilidad',
                'Prepara tus documentos antes de la cita',
                'Llega puntual a la cita agendada'
              ]
            }
          ]
        },

        organizations: {
          name: 'Organizaciones',
          icon: BuildingOfficeIcon,
          description: 'Gestión de organizaciones empresariales',
          overview: `
            <p>Módulo para clientes corporativos para gestionar sus organizaciones, miembros y solicitudes corporativas.</p>
          `,
          sections: [
            {
              id: 'corporate-dashboard',
              name: 'Dashboard Corporativo',
              description: 'Vista principal para clientes corporativos',
              roles: ['corporate_client'],
              content: `
                <p>Los clientes corporativos pueden crear y gestionar organizaciones completas con múltiples miembros.</p>
              `,
              features: [
                'Crear organización con nombre y descripción',
                'Subir imagen de perfil y portada',
                'Gestionar miembros del equipo',
                'Enviar invitaciones por email',
                'Ver invitaciones pendientes',
                'Crear solicitudes corporativas',
                'Publicar anuncios internos',
                'Ver estadísticas de la organización'
              ],
              steps: [
                {
                  title: 'Crear Organización',
                  description: 'Click en "Nueva Organización" y completa el formulario'
                },
                {
                  title: 'Personaliza',
                  description: 'Sube logo y portada, agrega descripción'
                },
                {
                  title: 'Invita Miembros',
                  description: 'Envía invitaciones por email a tu equipo'
                },
                {
                  title: 'Gestiona Solicitudes',
                  description: 'Crea solicitudes en nombre de la organización'
                },
                {
                  title: 'Publica Anuncios',
                  description: 'Comparte información con todos los miembros'
                }
              ]
            },
            {
              id: 'client-view',
              name: 'Vista de Cliente',
              description: 'Organizaciones donde eres miembro',
              roles: ['client', 'basic'],
              content: `
                <p>Los clientes pueden ver organizaciones donde son miembros y participar en ellas.</p>
              `,
              features: [
                'Ver mis organizaciones',
                'Aceptar o rechazar invitaciones',
                'Ver publicaciones de la organización',
                'Consultar solicitudes corporativas',
                'Ver otros miembros',
                'Acceder a recursos compartidos'
              ],
              steps: [
                {
                  title: 'Revisa Invitaciones',
                  description: 'Sección de invitaciones pendientes'
                },
                {
                  title: 'Acepta Invitación',
                  description: 'Click en "Aceptar" para unirte'
                },
                {
                  title: 'Explora la Organización',
                  description: 'Ve publicaciones, miembros y solicitudes'
                }
              ]
            },
            {
              id: 'invite-members',
              name: 'Invitar Miembros',
              description: 'Enviar invitaciones por email a tu equipo',
              roles: ['corporate_client'],
              content: `
                <p>Los clientes corporativos pueden invitar nuevos miembros a su organización enviando invitaciones por correo electrónico.</p>
                <p class="mt-2">Las invitaciones tienen estados: <strong>Pendiente</strong>, <strong>Aceptada</strong>, <strong>Rechazada</strong> o <strong>Expirada</strong>.</p>
              `,
              features: [
                'Enviar invitación por email',
                'Invitar usuarios registrados y no registrados',
                'Ver lista de invitaciones pendientes',
                'Estados de invitación: Pendiente, Aceptada, Rechazada, Expirada',
                'Reenviar invitaciones expiradas',
                'Cancelar invitaciones pendientes'
              ],
              steps: [
                {
                  title: 'Accede a tu Organización',
                  description: 'Navega a la sección de Organizaciones y selecciona tu organización'
                },
                {
                  title: 'Click en "Invitar Miembro"',
                  description: 'Botón en la sección de miembros de la organización'
                },
                {
                  title: 'Ingresa el email',
                  description: 'Escribe el correo electrónico de la persona que deseas invitar'
                },
                {
                  title: 'Envía la invitación',
                  description: 'Click en "Enviar" para enviar la invitación por email'
                },
                {
                  title: 'Seguimiento',
                  description: 'Revisa el estado de la invitación en la lista de invitaciones pendientes'
                }
              ],
              restrictions: [
                'Solo los clientes corporativos pueden invitar miembros',
                'No se puede invitar a alguien que ya es miembro',
                'Las invitaciones tienen un tiempo de expiración'
              ],
              tips: [
                'Verifica que el email sea correcto antes de enviar',
                'Si la invitación expira, puedes reenviarla',
                'Los usuarios no registrados recibirán un enlace para crear cuenta'
              ]
            },
            {
              id: 'member-management',
              name: 'Gestión de Miembros',
              description: 'Administrar los miembros de tu organización',
              roles: ['corporate_client'],
              content: `
                <p>Gestiona los miembros de tu organización: visualiza la lista completa y remueve miembros cuando sea necesario.</p>
              `,
              features: [
                'Ver lista completa de miembros',
                'Ver rol y fecha de ingreso de cada miembro',
                'Remover miembros de la organización',
                'Ver estadísticas de miembros activos'
              ],
              steps: [
                {
                  title: 'Accede a Miembros',
                  description: 'En tu organización, navega a la sección de miembros'
                },
                {
                  title: 'Revisa la lista',
                  description: 'Ve todos los miembros con su información'
                },
                {
                  title: 'Remover Miembro (si necesario)',
                  description: 'Click en "Remover" junto al miembro que deseas eliminar'
                },
                {
                  title: 'Confirma la acción',
                  description: 'Confirma que deseas remover al miembro de la organización'
                }
              ],
              restrictions: [
                'Solo los clientes corporativos pueden remover miembros',
                'No puedes removerte a ti mismo como propietario'
              ],
              tips: [
                'Al remover un miembro, pierde acceso inmediato a la organización',
                'Puedes re-invitar a un miembro removido posteriormente'
              ]
            },
            {
              id: 'posts-management',
              name: 'Gestionar Publicaciones',
              description: 'Crear, editar y administrar publicaciones internas',
              roles: ['corporate_client'],
              content: `
                <p>Publica anuncios y comunicaciones internas para los miembros de tu organización. Controla la <strong>visibilidad</strong> de cada publicación y destaca las más importantes con la opción de <strong>fijar</strong>.</p>
              `,
              features: [
                'Crear publicaciones con título y contenido',
                'Controlar visibilidad: visible para clientes miembros (sí/no)',
                'Fijar publicaciones importantes (pin/unpin)',
                'Editar publicaciones existentes',
                'Cambiar estado de publicación (activa/inactiva)',
                'Eliminar publicaciones con confirmación'
              ],
              steps: [
                {
                  title: 'Accede a Publicaciones',
                  description: 'En tu organización, navega a la sección de publicaciones'
                },
                {
                  title: 'Crear Nueva Publicación',
                  description: 'Click en "Nueva Publicación" y completa título y contenido'
                },
                {
                  title: 'Configura Visibilidad',
                  description: 'Elige si la publicación será visible para los clientes miembros'
                },
                {
                  title: 'Publica',
                  description: 'Click en "Publicar" para que sea visible según la configuración'
                },
                {
                  title: 'Gestiona (opcional)',
                  description: 'Fija, edita, desactiva o elimina publicaciones según necesites'
                }
              ],
              tips: [
                'Las publicaciones fijadas aparecen siempre al inicio de la lista',
                'Usa la opción de visibilidad para comunicaciones solo para administradores',
                'Desactiva publicaciones temporalmente en lugar de eliminarlas'
              ]
            },
            {
              id: 'client-invitations',
              name: 'Gestionar Invitaciones (Cliente)',
              description: 'Aceptar o rechazar invitaciones a organizaciones',
              roles: ['client', 'basic'],
              content: `
                <p>Cuando recibes una invitación para unirte a una organización, puedes <strong>aceptarla</strong> para ganar acceso o <strong>rechazarla</strong>. Las invitaciones también pueden <strong>expirar</strong> si no se responden a tiempo.</p>
              `,
              features: [
                'Ver invitaciones pendientes',
                'Aceptar invitación para unirse a la organización',
                'Rechazar invitación',
                'Ver invitaciones expiradas',
                'Notificación de nueva invitación'
              ],
              steps: [
                {
                  title: 'Revisa Invitaciones',
                  description: 'En la sección de Organizaciones, ve las invitaciones pendientes'
                },
                {
                  title: 'Lee los Detalles',
                  description: 'Revisa qué organización te invita y quién envió la invitación'
                },
                {
                  title: 'Acepta o Rechaza',
                  description: 'Click en "Aceptar" para unirte o "Rechazar" para declinar'
                },
                {
                  title: 'Accede a la Organización',
                  description: 'Si aceptaste, ya puedes ver publicaciones, miembros y solicitudes'
                }
              ],
              restrictions: [
                'Las invitaciones expiradas no pueden ser aceptadas',
                'Debes esperar una nueva invitación si la anterior expiró'
              ],
              tips: [
                'Responde las invitaciones a tiempo para evitar que expiren',
                'Al aceptar, ganarás acceso inmediato a los recursos de la organización'
              ]
            },
            {
              id: 'client-requests',
              name: 'Solicitudes dentro de Organización (Cliente)',
              description: 'Crear solicitudes corporativas como miembro',
              roles: ['client', 'basic'],
              content: `
                <p>Como miembro de una organización, puedes crear solicitudes corporativas que serán gestionadas por el administrador de la organización.</p>
              `,
              features: [
                'Crear solicitud dentro del contexto de la organización',
                'Describir la solicitud con detalle',
                'Ver estado de solicitudes enviadas',
                'Recibir respuestas del administrador',
                'Thread de conversación sobre la solicitud'
              ],
              steps: [
                {
                  title: 'Accede a la Organización',
                  description: 'Selecciona la organización donde deseas crear la solicitud'
                },
                {
                  title: 'Click en "Nueva Solicitud"',
                  description: 'Botón en la sección de solicitudes de la organización'
                },
                {
                  title: 'Describe tu Solicitud',
                  description: 'Escribe el detalle de lo que necesitas'
                },
                {
                  title: 'Envía',
                  description: 'El administrador recibirá tu solicitud y podrá responderte'
                },
                {
                  title: 'Sigue el Estado',
                  description: 'Revisa el estado y las respuestas en el thread de la solicitud'
                }
              ],
              tips: [
                'Sé específico en tu solicitud para facilitar la gestión',
                'Revisa las respuestas periódicamente para mantener la comunicación activa'
              ]
            },
            {
              id: 'client-leave',
              name: 'Salir de Organización',
              description: 'Abandonar una organización de la que eres miembro',
              roles: ['client', 'basic'],
              content: `
                <p>Puedes salir de una organización en cualquier momento. Al hacerlo, perderás acceso a publicaciones, miembros y solicitudes de esa organización.</p>
              `,
              features: [
                'Opción para abandonar la organización',
                'Confirmación antes de salir',
                'Pérdida inmediata de acceso tras confirmación'
              ],
              steps: [
                {
                  title: 'Accede a la Organización',
                  description: 'Selecciona la organización de la que deseas salir'
                },
                {
                  title: 'Click en "Salir de Organización"',
                  description: 'Opción disponible en la configuración de la organización'
                },
                {
                  title: 'Confirma',
                  description: 'Lee la advertencia y confirma que deseas salir'
                }
              ],
              restrictions: [
                'Al salir pierdes acceso inmediatamente',
                'Para volver necesitarás una nueva invitación'
              ],
              tips: [
                'Antes de salir, descarga cualquier información que necesites conservar',
                'Si sales por error, solicita al administrador una nueva invitación'
              ]
            },
            {
              id: 'corporate-requests',
              name: 'Gestionar Solicitudes Corporativas',
              description: 'Administrar solicitudes recibidas de miembros',
              roles: ['corporate_client'],
              content: `
                <p>Los administradores de organizaciones pueden ver, responder y gestionar las solicitudes enviadas por los miembros. El sistema incluye un thread de conversación y la opción de agregar <strong>notas internas</strong> que solo el administrador puede ver.</p>
              `,
              features: [
                'Ver todas las solicitudes recibidas',
                'Filtrar por estado (Pendiente, En Revisión, Respondida, Cerrada)',
                'Responder con mensajes visibles para el solicitante',
                'Agregar notas internas (ocultas al cliente)',
                'Cambiar estado de solicitudes',
                'Ver detalle completo de cada solicitud'
              ],
              steps: [
                {
                  title: 'Accede a Solicitudes',
                  description: 'En tu organización, navega a la sección de solicitudes'
                },
                {
                  title: 'Revisa Solicitudes Pendientes',
                  description: 'Filtra por estado "Pendiente" para ver las nuevas'
                },
                {
                  title: 'Abre el Detalle',
                  description: 'Click en la solicitud para ver la información completa'
                },
                {
                  title: 'Responde',
                  description: 'Escribe tu respuesta en el thread (visible para el solicitante)'
                },
                {
                  title: 'Nota Interna (opcional)',
                  description: 'Agrega notas internas visibles solo para ti como administrador'
                },
                {
                  title: 'Cambia el Estado',
                  description: 'Actualiza el estado según el progreso: En Revisión → Respondida → Cerrada'
                }
              ],
              tips: [
                'Usa notas internas para registrar decisiones o comentarios privados',
                'Responde rápidamente para mantener la confianza del equipo',
                'Cierra las solicitudes resueltas para mantener la lista organizada'
              ]
            }
          ]
        },

        intranet: {
          name: 'Intranet G&M',
          icon: ScaleIcon,
          description: 'Portal interno exclusivo para abogados de G&M',
          overview: `
            <p>Intranet exclusiva para abogados que pertenecen a la firma G&M (is_gym_lawyer = true).</p>
          `,
          sections: [
            {
              id: 'profile',
              name: 'Perfil de la Firma',
              description: 'Información corporativa de G&M',
              roles: ['lawyer'],
              content: `
                <p>Información institucional de la firma G&M Abogados.</p>
              `,
              features: [
                'Banner con atributos: Seguridad, Confianza, Tranquilidad',
                'Imagen de portada corporativa',
                'Logo de la firma',
                'Número total de miembros',
                'Invitaciones pendientes',
                'Fecha de creación de la firma',
                'Botón para ver organigrama'
              ]
            },
            {
              id: 'submit-report',
              name: 'Radicar Informe',
              description: 'Enviar informes de actividad y facturación',
              roles: ['lawyer'],
              content: `
                <p>Los abogados G&M pueden enviar informes mensuales de actividades y facturación.</p>
              `,
              features: [
                'Formulario completo de facturación',
                'Campo: No. Contrato',
                'Campo: Fecha Inicial del período',
                'Campo: Fecha Final del período',
                'Campo: Concepto de Pago',
                'Campo: Valor a Cobrar',
                'Adjuntar: Informe de Actividades (PDF)',
                'Adjuntar: Cuenta de Cobro/Factura (PDF)',
                'Adjuntar: Anexos adicionales',
                'Campo: Observaciones',
                'Validación de campos obligatorios',
                'Validación de fechas (final > inicial)'
              ],
              steps: [
                {
                  title: 'Click en "Radicar Informe"',
                  description: 'Botón en la sección de Intranet'
                },
                {
                  title: 'Completa información del contrato',
                  description: 'No. Contrato y período (fechas inicial y final)'
                },
                {
                  title: 'Detalla el concepto',
                  description: 'Concepto de pago y valor a cobrar'
                },
                {
                  title: 'Adjunta documentos',
                  description: 'Informe de actividades y cuenta de cobro en PDF'
                },
                {
                  title: 'Agrega anexos',
                  description: 'Documentos adicionales si son necesarios'
                },
                {
                  title: 'Envía el informe',
                  description: 'Revisa y envía para aprobación'
                }
              ],
              tips: [
                'Prepara todos los documentos antes de empezar',
                'Verifica que las fechas sean correctas',
                'Incluye todos los anexos necesarios'
              ]
            },
            {
              id: 'procedures',
              name: 'Procedimientos G&M',
              description: 'Biblioteca de documentos internos',
              roles: ['lawyer'],
              content: `
                <p>Acceso a procedimientos administrativos, operativos, de mercadeo y comerciales de la firma.</p>
              `,
              features: [
                'Búsqueda en tiempo real de procedimientos',
                'Resaltado de coincidencias en amarillo',
                'Links a documentos externos',
                'Scroll vertical (máx 500px)',
                'Categorías: Administrativos, Operativos, Mercadeo, Comerciales',
                'Apertura en nueva pestaña'
              ],
              steps: [
                {
                  title: 'Accede a Procedimientos',
                  description: 'Sección en la parte inferior de Intranet'
                },
                {
                  title: 'Busca procedimiento',
                  description: 'Usa la barra de búsqueda para encontrar documentos'
                },
                {
                  title: 'Click en el documento',
                  description: 'Se abrirá en una nueva pestaña'
                }
              ]
            },
            {
              id: 'organigram',
              name: 'Organigrama G&M',
              description: 'Estructura organizacional de la firma',
              roles: ['lawyer'],
              content: `
                <p>Visualización de la estructura jerárquica y organizacional de G&M Abogados.</p>
              `,
              features: [
                'Imagen del organigrama completo',
                'Modal para visualización ampliada',
                'Jerarquía de la firma',
                'Roles y responsabilidades',
                'Zoom y scroll en la imagen'
              ]
            },
            {
              id: 'document-download-fix',
              name: 'Descarga de Documentos Optimizada',
              description: 'Descarga sin pantalla en blanco en PWA',
              roles: ['lawyer'],
              content: `
                <p>La descarga de documentos de procedimientos G&M ha sido <strong>optimizada</strong> para evitar que la pantalla quede en blanco, especialmente en la aplicación móvil (PWA).</p>
                <p class="mt-2">Ahora los documentos se descargan usando el mismo patrón que los documentos jurídicos, garantizando una experiencia fluida.</p>
              `,
              features: [
                'Descarga mediante blob para evitar navegación',
                'No deja la pantalla en blanco en PWA',
                'Notificación de éxito al completar descarga',
                'Notificación de error si falla la descarga',
                'Soporta múltiples formatos: Word, PDF, etc.',
                'Funciona igual en móvil, tablet y escritorio',
                'Experiencia consistente con documentos jurídicos'
              ],
              steps: [
                {
                  title: 'Accede a Intranet G&M',
                  description: 'Click en "Intranet G&M" en el menú lateral'
                },
                {
                  title: 'Sección Procedimientos',
                  description: 'Scroll hacia abajo hasta "Procedimientos G&M"'
                },
                {
                  title: 'Buscar Documento',
                  description: 'Usa la barra de búsqueda para encontrar el procedimiento'
                },
                {
                  title: 'Click en Documento',
                  description: 'Click en el nombre del documento para descargarlo'
                },
                {
                  title: 'Descarga Automática',
                  description: 'El archivo se descarga sin abrir nueva pestaña'
                },
                {
                  title: 'Notificación',
                  description: 'Recibes confirmación de descarga exitosa'
                }
              ],
              tips: [
                'La descarga es instantánea, no esperes que se abra nueva pestaña',
                'Busca el archivo en tu carpeta de descargas',
                'Funciona perfectamente en la app móvil sin problemas',
                'Si falla, recibirás un mensaje de error claro'
              ]
            }
          ]
        },

        authentication: {
          name: 'Autenticación y Cuenta',
          icon: UserCircleIcon,
          description: 'Gestiona tu acceso a la plataforma y configuración de cuenta',
          overview: `
            <p>Este módulo cubre todas las funciones relacionadas con tu acceso a la plataforma: inicio de sesión, registro, recuperación de contraseña, perfil y seguridad.</p>
          `,
          sections: [
            {
              id: 'login-email',
              name: 'Iniciar sesión con email',
              description: 'Accede a tu cuenta usando tu correo electrónico y contraseña',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Ingresa con tu correo electrónico registrado y tu contraseña para acceder a todas las funcionalidades de la plataforma.</p>
              `,
              features: [
                'Ingreso con correo y contraseña',
                'Verificación reCAPTCHA de seguridad',
                'Redirección automática al Dashboard tras inicio exitoso',
                'Enlace a recuperación de contraseña'
              ],
              steps: [
                { title: 'Accede a la página de inicio', description: 'Navega a la URL de la plataforma' },
                { title: 'Ingresa tu correo', description: 'Escribe tu correo electrónico registrado' },
                { title: 'Ingresa tu contraseña', description: 'Escribe tu contraseña' },
                { title: 'Verifica el captcha', description: 'Completa la verificación de seguridad' },
                { title: 'Haz clic en "Iniciar Sesión"', description: 'Serás redirigido al Dashboard' }
              ]
            },
            {
              id: 'login-google',
              name: 'Iniciar sesión con Google',
              description: 'Accede rápidamente usando tu cuenta de Google',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Usa tu cuenta de Google para acceder sin necesidad de recordar otra contraseña.</p>
              `,
              features: [
                'Acceso con un solo clic usando Google',
                'No requiere contraseña adicional',
                'Registro automático si es tu primera vez'
              ],
              steps: [
                { title: 'Ve a la página de inicio', description: 'Navega a la URL de la plataforma' },
                { title: 'Haz clic en "Continuar con Google"', description: 'Debajo del formulario de inicio de sesión' },
                { title: 'Selecciona tu cuenta', description: 'Elige tu cuenta de Google en la ventana emergente' },
                { title: 'Autoriza el acceso', description: 'Confirma los permisos solicitados' },
                { title: 'Acceso completado', description: 'Serás redirigido al Dashboard automáticamente' }
              ]
            },
            {
              id: 'register',
              name: 'Registrar nueva cuenta',
              description: 'Crea una cuenta nueva en la plataforma',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Crea tu cuenta proporcionando tus datos personales y verificando tu correo electrónico con un código de seguridad.</p>
              `,
              features: [
                'Formulario de registro con datos personales',
                'Verificación de correo electrónico por código',
                'Aceptación de políticas de privacidad',
                'Opción de registro con Google'
              ],
              steps: [
                { title: 'Haz clic en "Crear cuenta"', description: 'En la página de inicio de sesión' },
                { title: 'Completa el formulario', description: 'Ingresa nombre, apellido, email y contraseña' },
                { title: 'Acepta las políticas', description: 'Marca la casilla de políticas de privacidad' },
                { title: 'Completa el captcha', description: 'Verifica que no eres un robot' },
                { title: 'Recibe el código', description: 'Se enviará un código a tu correo electrónico' },
                { title: 'Ingresa el código', description: 'Escribe el código recibido para verificar tu cuenta' },
                { title: 'Cuenta activada', description: 'Tu cuenta estará lista para usar' }
              ]
            },
            {
              id: 'forgot-password',
              name: 'Recuperar contraseña',
              description: 'Restablece tu contraseña si la olvidaste',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Si olvidaste tu contraseña, puedes restablecerla usando tu correo electrónico registrado y un código de verificación.</p>
              `,
              features: [
                'Envío de código de verificación al correo',
                'Creación de nueva contraseña segura',
                'Confirmación de contraseña',
                'Redirección automática a inicio de sesión'
              ],
              steps: [
                { title: 'Haz clic en "¿Olvidaste tu contraseña?"', description: 'En la página de inicio de sesión' },
                { title: 'Ingresa tu correo', description: 'Escribe el correo electrónico asociado a tu cuenta' },
                { title: 'Haz clic en "Enviar código"', description: 'Recibirás un código en tu correo' },
                { title: 'Ingresa el código', description: 'Escribe el código recibido' },
                { title: 'Crea tu nueva contraseña', description: 'Ingresa y confirma tu nueva contraseña' },
                { title: 'Contraseña actualizada', description: 'Ahora puedes iniciar sesión con tu nueva contraseña' }
              ]
            },
            {
              id: 'profile',
              name: 'Editar perfil',
              description: 'Actualiza tu información personal y foto de perfil',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Mantén tu información personal actualizada para que tus colegas y clientes puedan contactarte correctamente.</p>
              `,
              features: [
                'Edición de nombre, apellido y datos de contacto',
                'Cambio de foto de perfil',
                'Actualización de número de identificación',
                'Tipo de documento y fecha de nacimiento'
              ],
              steps: [
                { title: 'Abre el menú de usuario', description: 'Haz clic en tu nombre en la barra lateral' },
                { title: 'Selecciona "Perfil"', description: 'Se abrirá el modal de información de perfil' },
                { title: 'Haz clic en "Editar"', description: 'Para modificar tus datos personales' },
                { title: 'Actualiza los campos', description: 'Modifica la información que necesites' },
                { title: 'Guarda los cambios', description: 'Haz clic en "Guardar" para confirmar' }
              ]
            },
            {
              id: 'logout',
              name: 'Cerrar sesión',
              description: 'Cierra tu sesión de forma segura',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Cierra tu sesión cuando termines de usar la plataforma para proteger tu cuenta.</p>
              `,
              features: [
                'Cierre de sesión con un clic',
                'Limpieza de datos de sesión local',
                'Redirección a página de inicio de sesión'
              ],
              steps: [
                { title: 'Abre el menú de usuario', description: 'Haz clic en tu nombre en la barra lateral' },
                { title: 'Selecciona "Cerrar Sesión"', description: 'Tu sesión se cerrará inmediatamente' },
                { title: 'Redirección', description: 'Serás llevado a la página de inicio de sesión' }
              ]
            },
            {
              id: 'subscription-signin',
              name: 'Iniciar sesión para suscripción',
              description: 'Login desde el flujo de suscripción con redirección al checkout',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Si seleccionas un plan de suscripción sin estar autenticado, serás redirigido a una página de inicio de sesión especial que preserva tu plan seleccionado.</p>
              `,
              features: [
                'Login con email y contraseña',
                'Preservación del plan seleccionado en la URL',
                'Redirección automática al checkout tras login exitoso',
                'Enlace a registro de suscripción si no tienes cuenta'
              ],
              steps: [
                { title: 'Selecciona un plan', description: 'En la página de suscripciones, elige un plan' },
                { title: 'Redirección', description: 'Si no estás autenticado, llegarás al login de suscripción' },
                { title: 'Inicia sesión', description: 'Ingresa tu email, contraseña y completa el captcha' },
                { title: 'Checkout', description: 'Tras el login, serás redirigido al checkout con tu plan seleccionado' }
              ]
            },
            {
              id: 'subscription-signup',
              name: 'Registrarse para suscripción',
              description: 'Registro desde el flujo de suscripción con redirección al checkout',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Si no tienes cuenta, puedes registrarte directamente desde el flujo de suscripción. Tras verificar tu email, serás redirigido al checkout con el plan seleccionado.</p>
              `,
              features: [
                'Formulario de registro completo',
                'Verificación de email con código',
                'Preservación del plan seleccionado',
                'Redirección automática al checkout tras registro'
              ],
              steps: [
                { title: 'Desde el login de suscripción', description: 'Click en "Crear cuenta" en la página de login de suscripción' },
                { title: 'Completa el formulario', description: 'Ingresa nombre, apellido, email, contraseña y acepta políticas' },
                { title: 'Verifica tu email', description: 'Ingresa el código de verificación enviado a tu correo' },
                { title: 'Checkout', description: 'Tras la verificación, serás redirigido al checkout con tu plan' }
              ]
            },
            {
              id: 'idle-logout',
              name: 'Cierre automático por inactividad',
              description: 'La sesión se cierra automáticamente después de un período sin actividad',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Por seguridad, si no detectamos actividad en tu sesión durante 15 minutos, el sistema cerrará tu sesión automáticamente.</p>
              `,
              features: [
                'Detección de inactividad (mouse, teclado, scroll, touch)',
                'Cierre automático después de 15 minutos sin actividad',
                'Redirección a página de inicio de sesión',
                'Cualquier actividad reinicia el temporizador'
              ]
            },
            {
              id: 'login-attempts',
              name: 'Protección contra accesos no autorizados',
              description: 'El sistema limita intentos de acceso fallidos para proteger tu cuenta',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Después de varios intentos fallidos de inicio de sesión, el sistema bloqueará temporalmente el acceso para proteger tu cuenta.</p>
              `,
              features: [
                'Bloqueo temporal después de 3 intentos fallidos',
                'Tiempo de espera progresivo (60s, 120s, 240s...)',
                'Contador visible de segundos restantes',
                'Opción de recuperar contraseña durante bloqueo'
              ]
            }
          ]
        },

        subscriptions: {
          name: 'Suscripciones y Pagos',
          icon: CreditCardIcon,
          description: 'Gestiona tu plan de suscripción y métodos de pago',
          overview: `
            <p>La plataforma ofrece diferentes planes de suscripción para adaptarse a tus necesidades. Puedes ver los planes disponibles, suscribirte, actualizar o cancelar tu plan.</p>
          `,
          sections: [
            {
              id: 'view-plans',
              name: 'Ver planes disponibles',
              description: 'Conoce los diferentes planes de suscripción',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Compara los planes disponibles con sus características y precios para elegir el que mejor se adapte a tus necesidades.</p>
              `,
              features: [
                'Visualización de planes con características detalladas',
                'Comparación de precios y beneficios',
                'Indicador de plan actual (si ya tienes suscripción)',
                'Botones de selección para cada plan'
              ],
              steps: [
                { title: 'Navega a Suscripciones', description: 'Accede a la sección de planes' },
                { title: 'Revisa los planes', description: 'Compara características y precios' },
                { title: 'Selecciona un plan', description: 'Haz clic en el plan que desees' }
              ]
            },
            {
              id: 'checkout',
              name: 'Realizar pago de suscripción',
              description: 'Completa el pago de tu plan seleccionado',
              roles: ['lawyer', 'client', 'corporate_client', 'basic'],
              content: `
                <p>Completa el proceso de pago de forma segura usando tu tarjeta de crédito o débito a través de nuestro procesador de pagos Wompi.</p>
              `,
              features: [
                'Resumen del plan seleccionado',
                'Datos del usuario para facturación',
                'Pago seguro con tarjeta (Wompi)',
                'Activación gratuita para plan básico',
                'Confirmación por email',
                'Garantía de reembolso de 30 días',
                'Formulario de tarjeta: titular, número, mes/año expiración, CVC',
                'Tokenización segura de tarjeta vía Wompi',
                'Botón "Cambiar" para modificar método de pago guardado'
              ],
              steps: [
                { title: 'Selecciona un plan', description: 'Desde la página de suscripciones' },
                { title: 'Revisa el resumen', description: 'Verifica el plan y precio seleccionado' },
                { title: 'Plan gratuito', description: 'Si es plan básico (gratuito), no se muestra formulario de tarjeta. Click en "Confirmar Suscripción" directamente' },
                { title: 'Plan pago — datos de tarjeta', description: 'Si es plan pago, completa: nombre del titular, número de tarjeta, mes/año de expiración, CVC' },
                { title: 'Plan pago — guardar método', description: 'Click en "Guardar método de pago" para tokenizar la tarjeta de forma segura' },
                { title: 'Confirma el pago', description: 'Verás un badge verde "Método de pago guardado". Click en "Confirmar Suscripción"' },
                { title: 'Plan activado', description: 'Tu plan se activa inmediatamente' }
              ],
              restrictions: [
                'Los planes pagos requieren tarjeta de crédito o débito válida',
                'Si la tokenización falla, puedes reintentar con otra tarjeta',
                'El plan básico no requiere datos de pago'
              ],
              tips: [
                'El plan básico se activa inmediatamente sin necesidad de tarjeta',
                'Para planes pagos, puedes cambiar tu método de pago haciendo click en "Cambiar"',
                'Si la tarjeta es rechazada, verifica los datos e intenta de nuevo'
              ]
            },
            {
              id: 'cancel-subscription',
              name: 'Cancelar suscripción',
              description: 'Cancela tu suscripción actual',
              roles: ['lawyer', 'client', 'corporate_client'],
              content: `
                <p>Puedes cancelar tu suscripción en cualquier momento. Tu plan permanecerá activo hasta el final del período pagado.</p>
              `,
              features: [
                'Cancelación sin penalización',
                'Plan activo hasta final del período',
                'Opción de reactivar en cualquier momento',
                'Transición automática a plan gratuito'
              ],
              steps: [
                { title: 'Ve a tu suscripción', description: 'Accede a la sección de suscripciones' },
                { title: 'Selecciona "Cancelar"', description: 'Haz clic en la opción de cancelar suscripción' },
                { title: 'Confirma la cancelación', description: 'Lee las condiciones y confirma' },
                { title: 'Plan vigente', description: 'Tu plan sigue activo hasta el final del período' }
              ]
            },
            {
              id: 'upgrade-plan',
              name: 'Mejorar plan (Upgrade)',
              description: 'Cambia a un plan con más beneficios',
              roles: ['basic', 'client'],
              content: `
                <p>Mejora tu plan para acceder a funcionalidades avanzadas como firma electrónica, membrete personalizado y más.</p>
              `,
              features: [
                'Comparación con plan actual',
                'Cálculo proporcional del costo',
                'Activación inmediata de nuevos beneficios',
                'Acceso a firma electrónica y membrete'
              ],
              steps: [
                { title: 'Ve a Suscripciones', description: 'Accede a la sección de planes' },
                { title: 'Selecciona plan superior', description: 'Elige un plan con más beneficios' },
                { title: 'Completa el pago', description: 'Ingresa datos de pago si es plan pago' },
                { title: 'Beneficios activados', description: 'Los nuevos beneficios se activan inmediatamente' }
              ]
            }
          ]
        }
      };

      this.initialized = true;
    }
  }
});
