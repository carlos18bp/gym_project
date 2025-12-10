/**
 * ACTUALIZACIONES AL MANUAL DE USUARIO
 * Nuevas funcionalidades implementadas para integrar en user_guide.js
 * 
 * Este archivo contiene las secciones nuevas que deben agregarse al manual principal
 */

export const processesUpdates = {
  // Nueva sección para agregar en processes.sections
  'process-stages-management': {
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

  'process-detail-visual': {
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

  'process-historical': {
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
  }
};

export const documentsUpdates = {
  // Nuevas secciones para agregar en documents.sections
  'document-relationships': {
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

  'document-rejection-expiration': {
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

  'document-key-fields': {
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
  }
};

export const directoryUpdates = {
  // Nueva sección para agregar en directory.sections
  'user-detail-modal': {
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
    ],
    example: {
      title: 'Ejemplo: Consultar Procesos de un Cliente',
      description: 'Flujo completo de consulta desde el directorio.',
      steps: [
        {
          title: 'Abrir Directorio',
          description: 'Abogado busca información de "Juan Pérez"'
        },
        {
          title: 'Buscar',
          description: 'Escribe "Juan" en la barra de búsqueda'
        },
        {
          title: 'Click en Usuario',
          description: 'Click en la tarjeta de "Juan Pérez García"'
        },
        {
          title: 'Ver Información',
          description: 'Modal muestra: Email, Identificación, Contacto, Rol: Cliente'
        },
        {
          title: 'Scroll a Procesos',
          description: 'Ve 3 procesos: Tutela, Divorcio, Laboral'
        },
        {
          title: 'Abrir Tutela',
          description: 'Click en "Ver proceso" junto a la Tutela'
        },
        {
          title: 'Detalle del Proceso',
          description: 'Navega al detalle completo del proceso de tutela'
        }
      ],
      tips: [
        'Ahorra tiempo al no tener que navegar múltiples páginas',
        'Puedes ver rápidamente cuántos procesos tiene un cliente',
        'Útil para preparar reuniones con clientes'
      ]
    }
  }
};

export const intranetUpdates = {
  // Nueva sección para agregar en intranet.sections
  'document-download-fix': {
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
};
