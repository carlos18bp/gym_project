import { DocumentTextIcon } from '@heroicons/vue/24/outline';

export const documentsContent = {
  name: 'Archivos Jurídicos',
  icon: DocumentTextIcon,
  description: 'Gestión de documentos dinámicos, minutas y contratos',
  overview: `
    <p>El módulo de Archivos Jurídicos permite crear, gestionar y firmar documentos legales de manera digital.</p>
    <p class="mt-2"><strong>Para Abogados:</strong> 8 pestañas principales</p>
    <ul class="list-disc list-inside mt-2 space-y-1">
      <li><strong>Minutas:</strong> Plantillas de todos los abogados (Published, Draft) — visibilidad y control compartidos</li>
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
      id: 'guided-tour',
      name: 'Guía interactiva del módulo',
      description: 'Tour guiado paso a paso sobre la interfaz de Archivos Jurídicos',
      roles: ['lawyer', 'client', 'corporate_client', 'basic', 'admin'],
      content: `
        <p>El módulo cuenta con un <strong>tour guiado interactivo</strong> que resalta cada elemento de la pantalla (pestañas y botones) con un foco visual y una explicación breve, para que aprendas a usarlo sin leer manuales.</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li><strong>Tarjeta de bienvenida:</strong> en tu primer ingreso aparece una invitación al centro de la pantalla; elige "Comenzar recorrido" o "Ahora no".</li>
          <li><strong>Contenido según tu rol:</strong> los abogados ven 10 pasos (minutas, documentos de clientes, firma, membrete); los clientes 7 pasos (carpetas, documentos, firmas).</li>
          <li><strong>Avance visible:</strong> cada paso muestra una barra de progreso y el conteo "Paso X de Y"; el tour cambia de pestaña automáticamente cuando lo necesita.</li>
          <li><strong>Navegación:</strong> usa "Siguiente" y "Anterior" (o las flechas ← → del teclado); "Omitir guía" lo cierra en cualquier momento.</li>
          <li><strong>Cierre útil:</strong> el último paso te muestra el botón <strong>"?"</strong> del encabezado, desde donde puedes repetir la guía cuando quieras. Mientras la guía esté pendiente, ese botón muestra un punto azul parpadeante.</li>
          <li><strong>Repaso mensual:</strong> si pasaron más de 30 días desde la última vez, el sistema pregunta si quieres ver la guía de nuevo (nunca se fuerza).</li>
        </ul>
        <p class="mt-2">Además, junto a los botones principales hay <strong>iconos de información (ⓘ)</strong>: pasa el cursor sobre ellos para ver una descripción rápida sin ejecutar el tour completo.</p>
      `,
      steps: [
        {
          title: 'Inicia sesión y entra a Archivos Jurídicos',
          description: 'En tu primer ingreso aparece la tarjeta de bienvenida; elige "Comenzar recorrido"'
        },
        {
          title: 'Recorre los pasos con "Siguiente"',
          description: 'Cada paso resalta una pestaña o botón, explica para qué sirve y muestra tu avance en la barra de progreso'
        },
        {
          title: 'Termina en el botón de ayuda',
          description: 'El último paso te muestra el botón "?" y al finalizar verás una breve celebración; el sistema recuerda que ya viste la guía'
        },
        {
          title: 'Relánzalo cuando lo necesites',
          description: 'Haz clic en el botón "?" del encabezado para repetir el tour desde la bienvenida'
        }
      ],
      tips: [
        'Si tienes documentos pendientes de firma, el tour agrega un paso final que te lleva directo a esa pestaña',
        'En el celular el tour es más corto: las pestañas se explican sobre el menú desplegable',
        'Los iconos ⓘ quedan siempre disponibles como referencia rápida después del tour',
        'Omitir la guía también cuenta como vista: el punto azul del botón "?" desaparece y no se te vuelve a ofrecer hasta dentro de 30 días'
      ]
    },
    {
      id: 'editor-toolbar-by-role',
      name: 'Botones del Editor según tu Rol',
      description: 'Qué ves en el editor TinyMCE y por qué',
      roles: ['lawyer', 'client', 'corporate_client', 'basic', 'admin'],
      content: `
        <p>El editor TinyMCE de minutas y documentos muestra distintos botones según tu rol y la ruta en la que estés. Esta es la referencia rápida:</p>
        <table class="mt-3 w-full text-left border-collapse text-sm">
          <thead><tr class="border-b">
            <th class="py-2 pr-4">Rol</th>
            <th class="py-2 pr-4">Ruta</th>
            <th class="py-2">Botones de la barra principal</th>
          </tr></thead>
          <tbody>
            <tr class="border-b"><td class="py-2 pr-4">Lawyer / Admin / Staff / Superuser</td><td class="py-2 pr-4"><code>/lawyer/editor/...</code></td><td class="py-2"><strong>Guardar como borrador · Continuar · Regresar</strong></td></tr>
            <tr class="border-b"><td class="py-2 pr-4">Cliente / Corporativo</td><td class="py-2 pr-4"><code>/client/editor/edit/...</code></td><td class="py-2">Guardar · Regresar (variables protegidas en amarillo)</td></tr>
            <tr class="border-b"><td class="py-2 pr-4">Básico</td><td class="py-2 pr-4">—</td><td class="py-2">Bloqueado: el route guard no permite el acceso</td></tr>
          </tbody>
        </table>
      `,
      features: [
        '"Continuar" es el paso central del flujo de creación: lleva a la configuración de variables',
        'Los clientes y corporativos ven sus variables como cápsulas amarillas no editables (sólo escriben los valores alrededor)',
        'Si tu cuenta tiene is_staff=true o is_superuser=true, ves los botones de abogado aunque tu role persistido sea distinto'
      ],
      tips: [
        'Si esperabas el botón Continuar y no aparece, recarga la página: el editor se sincroniza con tu rol al montar',
        'La pestaña "Mis Documentos" del abogado usa el mismo editor pero con el flujo de cliente para completar variables'
      ]
    },
    {
      id: 'document-form-modes',
      name: 'Modos del DocumentForm',
      description: 'Los 4 contextos en los que se abre el formulario de variables',
      roles: ['lawyer', 'client', 'corporate_client', 'basic', 'admin'],
      content: `
        <p>El formulario para diligenciar variables (<code>DocumentForm.vue</code>) opera en cuatro modos según la ruta. Saber en qué modo estás ayuda a entender qué pasa al "Continuar":</p>
      `,
      features: [
        '<strong>Creator</strong> — el abogado crea desde una plantilla; al guardar nace un documento nuevo',
        '<strong>Editor</strong> — se reanuda el diligenciamiento de un documento existente; al guardar se actualiza el mismo registro',
        '<strong>Formalize</strong> — el documento ya está completo y entra al flujo de firmas; cambia de estado a PendingSignatures',
        '<strong>Correction</strong> — un documento Rejected/Expired regresa para corrección; al reenviar entra de nuevo al flujo de firmas'
      ],
      tips: [
        'En modo Creator y Editor verás el editor TinyMCE primero; pulsar "Continuar" lleva a la configuración de variables',
        'En modo Formalize y Correction el flujo arranca directamente sobre la solicitud de firmas — no requiere reabrir el editor'
      ]
    },
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
        <p class="mt-2"><strong>Visibilidad compartida de Minutas:</strong> Todos los abogados ven todas las minutas, sin importar quién las creó. La columna "Creado por" indica el creador, que es quien controla la minuta: solo él puede eliminarla, publicarla/moverla a borrador y activar o desactivar la edición compartida ("Compartir edición", activada por defecto). Cuando una minuta está compartida (badge "Compartida"), los demás abogados también pueden editarla; si no, solo pueden previsualizarla, copiarla o agregarla a carpetas. Usa el filtro "Todas / Compartidas / Mías" para alternar entre todas las minutas del equipo, las compartidas para edición y las que tú creaste.</p>
      `,
      features: [
        'Minutas: Crear y gestionar plantillas de todos los abogados (visibilidad compartida)',
        'Columna "Creado por": indica el abogado que creó y controla cada minuta',
        'Edición compartida: activada por defecto; el creador puede desactivarla con "Dejar de compartir"',
        'Minutas ajenas: siempre se pueden previsualizar y copiar; editar solo si están compartidas; eliminar y publicar son exclusivas del creador',
        'Filtro "Todas / Compartidas / Mías": ver todas las minutas, solo las compartidas o solo las propias',
        'Mis Documentos: Usar minutas para crear documentos propios y formalizarlos',
        'Carpetas: Organizar documentos en carpetas personalizadas',
        'Dcs. Por Firmar: Documentos pendientes de firma',
        'Dcs. Formalizados: Archivo de documentos con firmas completadas',
        'Dcs. Archivados: Documentos rechazados o expirados para referencia y corrección',
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
            description: 'Click en "Guardar como borrador" - el documento queda en estado Draft',
            note: 'Útil si vas a volver más tarde antes de configurar variables'
          },
          {
            title: 'Continuar',
            description: 'Click en el botón "Continuar" del editor para pasar a la configuración de variables',
            note: 'Es el flujo natural: el editor te lleva al paso siguiente sin tener que volver al dashboard'
          },
          {
            title: 'Configurar Variables',
            description: 'En la vista de configuración define el tipo de cada variable {{...}}',
            note: 'Tipos disponibles: texto, número, fecha, email, selector, etc.; añade tooltip para guiar al cliente'
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
      id: 'contract-execution',
      name: 'Ejecución del Contrato — Cuentas de Cobro',
      description: 'Seguimiento de pagos por cuotas en documentos formalizados',
      roles: ['lawyer', 'client', 'corporate_client', 'basic', 'admin'],
      content: `
        <p>Los documentos <strong>completamente firmados</strong> que tengan configurada una variable de tipo <strong>"Forma de pago (N cuotas)"</strong> habilitan el submódulo de ejecución del contrato: un registro ordenado de las cuentas de cobro de cada cuota pactada.</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li><strong>Configuración (abogado):</strong> al clasificar las variables de la minuta, marca una como "Forma de pago (N cuotas)" e indica el número de cuotas. El dato aparece en el resumen del documento junto al valor y el plazo.</li>
          <li><strong>Carga secuencial:</strong> la cuota 1 siempre está disponible; cada cuota siguiente se habilita cuando la anterior es <strong>aceptada</strong> por el abogado. Mientras una cuenta esté en revisión no se puede cargar otra.</li>
          <li><strong>Subir Cuenta de Cobro:</strong> desde el menú del documento firmado, adjunta el archivo (PDF, JPG, PNG o DOCX, máx. 20 MB) y opcionalmente el monto y notas. El abogado recibe una notificación por correo y en la campana.</li>
          <li><strong>Revisión del abogado:</strong> en "Ver Cuentas de Cobro" puede descargar el archivo y <strong>Aceptar</strong> (habilita la siguiente cuota) o <strong>Rechazar</strong> con un motivo obligatorio. El cliente es notificado en ambos casos.</li>
          <li><strong>Cuota rechazada:</strong> el cliente ve el motivo y puede volver a cargar el archivo corregido para la misma cuota.</li>
          <li><strong>Seguimiento:</strong> la vista muestra el progreso (X/N aceptadas), el total de montos aceptados y el estado de cada cuota: Pendiente, Cargada (en revisión), Aceptada o Rechazada.</li>
        </ul>
        <p class="mt-2">Los documentos firmados sin forma de pago configurada no muestran estas opciones.</p>
      `,
      steps: [
        {
          title: 'Configura la forma de pago',
          description: 'El abogado clasifica una variable como "Forma de pago (N cuotas)" con el número de cuotas pactadas'
        },
        {
          title: 'Carga la cuenta de cobro',
          description: 'Con el documento firmado, usa "Subir Cuenta de Cobro" y adjunta el archivo de la cuota disponible'
        },
        {
          title: 'El abogado revisa',
          description: 'Acepta la cuenta (habilita la siguiente cuota) o la rechaza con un motivo'
        },
        {
          title: 'Consulta el historial',
          description: '"Ver Cuentas de Cobro" muestra el progreso, los montos y el estado de cada cuota, con descarga de comprobantes'
        }
      ],
      tips: [
        'El monto es opcional pero ayuda a llevar la contabilidad del contrato en la vista de detalle',
        'La carga puede hacerla el cliente asignado o el abogado creador en su nombre',
        'Ambas partes pueden descargar los comprobantes en cualquier momento'
      ]
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
    },
    {
      id: 'variables-config',
      name: 'Configuración de Variables',
      description: 'Definir los campos dinámicos reutilizables de una minuta',
      roles: ['lawyer'],
      content: `
        <p>Desde la ruta <code>/dynamic_document_dashboard/lawyer/variables-config</code> los abogados configuran las <strong>variables dinámicas</strong> de una minuta: los campos que el cliente (o el propio abogado) llenará al usar el documento.</p>
        <p class="mt-2">Cada variable define su nombre, tipo de dato, si es obligatoria, texto de ayuda y opciones (para selectores).</p>
      `,
      features: [
        'Nombre de la variable (aparece subrayada en amarillo en el editor)',
        'Tipo de campo: texto, área de texto, número (moneda), fecha, email, selector',
        'Obligatoriedad y validaciones por tipo',
        'Help text / tooltip para guiar al cliente',
        'Opciones del selector (para campos tipo selector)',
        'Reutilización en múltiples minutas'
      ],
      steps: [
        {
          title: 'Abre la minuta',
          description: 'Desde la pestaña "Minutas", click en "⚙️ Configurar Variables"'
        },
        {
          title: 'Agrega variables',
          description: 'Define nombre técnico, etiqueta visible y tipo de dato'
        },
        {
          title: 'Configura validaciones',
          description: 'Marca obligatoriedad y agrega help text'
        },
        {
          title: 'Guarda la configuración',
          description: 'Las variables quedan disponibles para el formulario de uso'
        }
      ],
      tips: [
        'Usa nombres técnicos sin espacios (ej: nombre_cliente) y etiquetas descriptivas',
        'El help text ayuda a los clientes a llenar correctamente el campo',
        'Los campos tipo moneda formatean automáticamente miles y decimales'
      ],
      restrictions: [
        'Solo accesible para abogados',
        'Los cambios afectan a documentos futuros, no a los ya formalizados'
      ]
    },
    {
      id: 'document-permissions',
      name: 'Permisos sobre Documentos',
      description: 'Controlar quién ve y quién usa cada minuta/documento',
      roles: ['lawyer'],
      content: `
        <p>Cada documento dinámico tiene un sistema de permisos granular que distingue entre <strong>visibilidad</strong> (quién puede verlo) y <strong>usabilidad</strong> (quién puede usarlo para crear un documento propio).</p>
        <p class="mt-2">Los permisos se otorgan por usuario específico, por rol, o combinando ambos. También existe un modo público (cualquier usuario autenticado).</p>
      `,
      features: [
        'Acceso público: toggle para que cualquier usuario autenticado vea la minuta',
        'Permisos de visibilidad: qué usuarios pueden ver el documento',
        'Permisos de usabilidad: qué usuarios pueden usar la minuta para crear un documento propio',
        'Otorgar por usuario: seleccionar clientes individuales',
        'Otorgar por rol: abrir a todos los "client", "corporate_client" o "basic"',
        'Otorgar combinado: mezclar usuarios específicos + roles en la misma operación',
        'Revocar por usuario o por rol',
        'Historial de permisos otorgados visible en el modal'
      ],
      steps: [
        {
          title: 'Abre el modal de permisos',
          description: 'Desde la tabla de documentos, click en el ícono de candado / permisos'
        },
        {
          title: 'Elige el tipo de permiso',
          description: 'Visibilidad (solo ver) o Usabilidad (ver + usar)'
        },
        {
          title: 'Selecciona beneficiarios',
          description: 'Busca y marca usuarios, y/o selecciona roles completos'
        },
        {
          title: 'Confirma',
          description: 'Los permisos se otorgan atómicamente; se listan en la tabla del modal'
        }
      ],
      tips: [
        'Usa "por rol" cuando quieras abrir una minuta a todos los clientes sin seleccionarlos uno por uno',
        'El acceso público es útil para minutas genéricas de alto volumen',
        'Revoca permisos al cerrar una colaboración para evitar accesos residuales'
      ],
      restrictions: [
        'Solo abogados pueden gestionar permisos',
        'El creador del documento siempre conserva acceso'
      ]
    }
  ]
};
