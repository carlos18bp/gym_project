import { defineStore } from 'pinia';
import {
  HomeIcon,
  UsersIcon,
  FolderIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  ScaleIcon
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
                'Contador de resultados encontrados'
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
                'Selección de Cliente desde base de datos',
                'Asignación de Abogado responsable',
                'Subida de múltiples archivos adjuntos',
                'Campos: Demandante, Demandado, Autoridad, Referencia, Subclase',
                'Definición de etapa procesal inicial'
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
                  description: 'Selecciona el cliente asociado y el abogado responsable'
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
                    description: 'Cliente: Selecciona "Juan Pérez" de la lista, Abogado: Asigna el responsable'
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
                'Paginación de archivos (10 por página)'
              ],
              tips: [
                'Usa la búsqueda del expediente para encontrar documentos específicos',
                'El timeline muestra visualmente el progreso del caso'
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
            }
          ]
        },

        documents: {
          name: 'Archivos Jurídicos',
          icon: DocumentTextIcon,
          description: 'Gestión de documentos dinámicos, minutas y contratos',
          overview: `
            <p>El módulo de Archivos Jurídicos permite crear, gestionar y firmar documentos legales de manera digital.</p>
            <p class="mt-2"><strong>Para Abogados:</strong> 5 pestañas principales</p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li><strong>Minutas:</strong> Documentos creados (Published, Draft, Progress, Completed)</li>
              <li><strong>Documentos por Firmar:</strong> Pendientes de firma (PendingSignatures)</li>
              <li><strong>Documentos Firmados:</strong> Completamente firmados (FullySigned)</li>
              <li><strong>Documentos de Clientes (Completados):</strong> Finalizados por clientes</li>
              <li><strong>Documentos de Clientes (En Progreso):</strong> En proceso de completado</li>
            </ul>
            <p class="mt-2"><strong>Para Clientes:</strong> 5 pestañas principales</p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li><strong>Carpetas:</strong> Documentos organizados por carpetas</li>
              <li><strong>Mis Documentos:</strong> Documentos asignados</li>
              <li><strong>Usar Documento:</strong> Completar plantillas</li>
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
                <p>Los abogados tienen acceso a 5 pestañas para gestionar documentos en diferentes estados del flujo de trabajo.</p>
              `,
              features: [
                'Minutas: Crear, editar, duplicar, asignar documentos',
                'Por Firmar: Ver documentos pendientes de firma',
                'Firmados: Archivo de documentos completados',
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
                '👀 Vista Previa: Ver sin editar'
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
                'Múltiples firmantes en un documento'
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
                'Indicadores de campos obligatorios'
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
            }
          ]
        }
      };

      this.initialized = true;
    }
  }
});
