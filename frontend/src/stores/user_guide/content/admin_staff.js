import { ShieldCheckIcon } from '@heroicons/vue/24/outline';

export const adminStaffContent = {
  name: 'Administración del Sistema',
  icon: ShieldCheckIcon,
  description: 'Capacidades transversales para usuarios admin / staff / superuser',
  overview: `
    <p>Este módulo es exclusivo para usuarios <strong>admin</strong>, <strong>staff</strong> o <strong>superuser</strong>. Reúne las capacidades transversales que tienen sobre los demás módulos.</p>
    <p class="mt-2">El sistema agrupa estos usuarios bajo el predicado <em>"lawyer-like"</em>: comparten con los abogados el acceso a vistas de creación de minutas, configuración de variables, bandeja de servicios y herramientas internas. Si un día tu rol persistido cambia (por ejemplo de <code>client</code> a <code>admin</code>) los privilegios se aplican sin requerir nuevo login: la app refresca tu rol desde el backend.</p>
  `,
  sections: [
    {
      id: 'admin-what-is-lawyer-like',
      name: '¿Qué significa "lawyer-like"?',
      description: 'Por qué admin/staff/superuser ven herramientas de abogado',
      roles: ['admin'],
      content: `
        <p>El sistema considera a un usuario <strong>lawyer-like</strong> si cumple alguna de estas condiciones:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li><code>role === 'lawyer'</code></li>
          <li><code>role === 'admin'</code></li>
          <li><code>is_staff === true</code></li>
          <li><code>is_superuser === true</code></li>
        </ul>
        <p class="mt-2">Cuando entras a una ruta protegida por <code>requiresLawyer</code> (como <code>/dynamic_document_dashboard/lawyer/editor/...</code>) o el editor decide qué botones mostrar, se evalúa este predicado — no solo el rol literal.</p>
      `,
      features: [
        'Acceso a "Nueva Minuta" y al editor con botón Continuar',
        'Acceso al panel de "Mis Documentos" con formalización y firmas',
        'Acceso a la bandeja de Servicios (todas las solicitudes)',
        'Acceso al admin de catálogo de servicios (/services_admin)',
        'Acceso al directorio completo de usuarios',
        'Mismas opciones de menú contextual de tarjetas de documento que un abogado'
      ],
      tips: [
        'Tu manual y tu navegación se filtran como "admin": ves todo lo que ve un abogado, más este módulo dedicado',
        'Si pierdes el acceso a una vista que esperabas tener, verifica que tu cuenta tenga is_staff=true o role=admin'
      ]
    },
    {
      id: 'admin-services-catalog',
      name: 'Administración del Catálogo de Servicios',
      description: 'Crear, editar y publicar servicios y trámites',
      roles: ['admin'],
      content: `
        <p>La ruta <code>/services_admin</code> es la herramienta principal para gestionar el catálogo de Servicios y Trámites visible a los clientes.</p>
      `,
      features: [
        'Crear y editar servicios (nombre, descripción, ícono)',
        'Definir etapas (stages) y agrupar campos por etapa',
        'Definir campos por etapa: tipo, validaciones, archivos permitidos',
        'Toggle Activo/Inactivo: oculta el servicio del catálogo público sin borrarlo',
        'Toggle Destacado: aparece también en el Dashboard',
        'Validaciones de archivos por campo (extensiones permitidas, cantidad máxima)',
        'Reordenar prioridad de servicios destacados'
      ],
      steps: [
        { title: 'Entra a /services_admin', description: 'Ruta protegida por requiresAdmin' },
        { title: 'Crea o edita un servicio', description: 'Define nombre, descripción y ícono' },
        { title: 'Diseña las etapas', description: 'Cada etapa agrupa campos relacionados (ej: Datos del solicitante, Documentos)' },
        { title: 'Configura los campos', description: 'Tipo (texto, número, archivo, etc.), help text, obligatoriedad, validaciones' },
        { title: 'Activa el servicio', description: 'Toggle Activo cuando esté listo para clientes' }
      ],
      tips: [
        'Marca como Destacado solo los servicios estratégicos — el Dashboard tiene espacio limitado',
        'Usa claves técnicas sin espacios para los campos (ej: razon_social) — facilita la generación del PDF'
      ]
    },
    {
      id: 'admin-dynamic-documents',
      name: 'Documentos Dinámicos: privilegios admin',
      description: 'Qué puedes hacer con minutas y documentos',
      roles: ['admin'],
      content: `
        <p>Como admin/staff/superuser tienes el mismo acceso que un abogado al módulo de Archivos Jurídicos.</p>
      `,
      features: [
        'Crear minutas nuevas (botón "Nueva Minuta") y configurar variables',
        'Editar minutas existentes — el editor muestra los botones Guardar como borrador, Continuar y Regresar',
        'Formalizar documentos con firmas electrónicas',
        'Editar contenido de documentos completados por clientes (variables protegidas en amarillo)',
        'Acceso a las 8 pestañas de abogado: Minutas, Mis Documentos, Carpetas, Por Firmar, Firmados, Archivados, Completados/En progreso por clientes'
      ],
      restrictions: [
        'La protección de variables ({{nombre}} en amarillo) sigue activa cuando editas un documento de cliente — esto es por diseño, no es un bug',
        'Si tu rol persistido es client/corporate_client pero tienes is_staff=true, igualmente verás las herramientas de abogado'
      ]
    },
    {
      id: 'admin-data-reassignment',
      name: 'Reasignación de Datos de Abogado',
      description: 'Transferir procesos y documentos entre abogados y archivar cuentas',
      roles: ['admin'],
      content: `
        <p>El módulo <strong>Reasignación de Datos</strong> (menú lateral "Reasignación de Datos", solo visible para administradores) permite transferir los procesos y documentos de un abogado a otro — útil cuando un abogado deja la firma, se ausenta, o para redistribuir la carga.</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li><strong>Selección:</strong> elige un abogado origen y un abogado destino (el destino excluye automáticamente al origen y a los abogados archivados).</li>
          <li><strong>Vista previa:</strong> el sistema lista los procesos y los documentos transferibles con casillas de selección individual y "Seleccionar todos". Los documentos en proceso de firma (Pendiente de Firmas, Firmado, Rechazado, Vencido) aparecen como <strong>no transferibles</strong> con el motivo.</li>
          <li><strong>Ejecución atómica:</strong> al confirmar, todo se transfiere o nada. Los procesos pasan al abogado destino y la gestión de los documentos también; el campo "creado por" nunca cambia (auditoría).</li>
          <li><strong>Archivado (opcional):</strong> marca "Archivar abogado origen al finalizar" para desactivar su cuenta.</li>
        </ul>
        <p class="mt-2">El botón <strong>"Reasignar Datos"</strong> del dashboard es un acceso rápido, y las tarjetas de métricas muestran abogados activos vs archivados.</p>
      `,
      features: [
        'Selectores de abogado origen/destino con validación (deben ser distintos y el destino activo)',
        'Vista previa con checkboxes por proceso/documento y "Seleccionar todos"',
        'Documentos en estados de firma protegidos: no se pueden transferir (se muestran con el motivo)',
        'Transferencia atómica (todo o nada) con registro en el historial de actividad de ambos abogados',
        'Archivar el abogado origen: bloquea su login (tradicional y Google/Outlook), lo excluye de listados y notificaciones',
        'Card "Abogados archivados" con botón "Restaurar" — el archivado es reversible'
      ],
      restrictions: [
        'Solo usuarios con rol admin (o is_staff/is_superuser) acceden al módulo — los abogados no lo ven',
        'El campo "creado por" del documento nunca se modifica: la trazabilidad de autoría se preserva',
        'Un abogado con procesos asignados no puede eliminarse del sistema; debe archivarse',
        'Los documentos en firma (Pendiente/Firmado/Rechazado/Vencido) no son elegibles para transferencia'
      ],
      tips: [
        'Revisa la vista previa y los documentos no transferibles antes de confirmar',
        'El filtro "Mis Documentos" de cada abogado incluye lo que creó O lo que ahora gestiona tras una reasignación',
        'Si archivas por error, restaura al abogado desde la card "Abogados archivados"'
      ]
    },
    {
      id: 'admin-secop-services-visibility',
      name: 'Visibilidad transversal: SECOP y Servicios',
      description: 'Qué información adicional ves vs un usuario regular',
      roles: ['admin'],
      content: `
        <p>En SECOP y Servicios tu vista no se limita a tus propias clasificaciones o solicitudes.</p>
      `,
      features: [
        'SECOP: trigger manual de sincronización (solo lawyer-like puede dispararlo)',
        'Servicios: bandeja completa con todas las solicitudes recibidas, no solo las propias',
        'Servicios: filtros avanzados por estado, servicio, número de radicado, fecha y búsqueda libre',
        'Servicios: respuesta al cliente con archivos adjuntos y transición de estados'
      ]
    },
    {
      id: 'admin-django-panel',
      name: 'Django Admin: gestión profunda',
      description: 'Cuándo usar el admin de Django y cuándo no',
      roles: ['admin'],
      content: `
        <p>Para operaciones de bajo nivel —crear usuarios, asignar roles, suscripciones manuales, auditoría de modelos— se utiliza el panel admin de Django (<code>/admin</code>).</p>
        <p class="mt-2">Esta interfaz es para uso interno de operaciones, no la usan los clientes.</p>
      `,
      features: [
        'Gestión de usuarios: crear, editar, resetear contraseñas, marcar is_staff/is_superuser',
        'Asignar el campo <code>role</code> (lawyer / admin / client / corporate_client / basic)',
        'Auditoría de cualquier modelo del sistema (procesos, documentos, solicitudes, suscripciones)',
        'Configuración avanzada de modelos que no exponen UI (ej: SyncLog de SECOP, ServiceRequestSequence)'
      ],
      restrictions: [
        'El panel de Django requiere is_staff=true en la cuenta del usuario',
        'Cambios sensibles (eliminar usuarios, cambiar roles) requieren coordinación con el equipo técnico'
      ],
      tips: [
        'Prefiere las vistas in-app (/services_admin, dashboard de abogado) cuando existan — el panel de Django es para casos que la UI no cubre'
      ]
    }
  ]
};
