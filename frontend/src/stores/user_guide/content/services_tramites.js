import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline';

export const servicesTramitesContent = {
  name: 'Servicios y Trámites',
  icon: ClipboardDocumentListIcon,
  description: 'Catálogo de servicios legales y trámites con formularios por etapas',
  overview: `
    <p>Servicios y Trámites es el catálogo de procedimientos legales (por ejemplo, <em>Registro Marcario</em>) que los clientes pueden iniciar a través de formularios dinámicos por etapas.</p>
    <p class="mt-2">Cada solicitud recibe un número de radicado automático (<code>AÑO-CONSECUTIVO</code>) y genera un PDF corporativo. Los abogados gestionan las solicitudes desde una bandeja con respuestas y adjuntos.</p>
  `,
  sections: [
    {
      id: 'services-hub-tabs',
      name: 'Navegación por Pestañas',
      description: 'Servicios, Mis Solicitudes y Bandeja',
      roles: ['lawyer', 'client', 'corporate_client', 'basic'],
      content: `
        <p>El centro del módulo es <strong>ServicesHub</strong>, que unifica las tres pestañas principales:</p>
      `,
      features: [
        'Servicios: catálogo completo de trámites disponibles',
        'Mis Solicitudes: tus solicitudes enviadas (clientes/basic/corporate_client)',
        'Bandeja: solicitudes recibidas para gestionar (solo abogados)',
        'En escritorio: tabs horizontales; en móvil: dropdown'
      ]
    },
    {
      id: 'services-catalog',
      name: 'Catálogo de Servicios',
      description: 'Explorar los servicios disponibles',
      roles: ['lawyer', 'client', 'corporate_client', 'basic'],
      content: `
        <p>El catálogo muestra los servicios activos con su ícono, nombre y descripción. Al hacer click se accede al formulario del servicio.</p>
        <p class="mt-2">Los servicios marcados como <strong>destacados</strong> aparecen también en el Dashboard.</p>
      `,
      features: [
        'Grid con ícono personalizado por servicio',
        'Nombre y descripción visibles',
        'Servicios destacados aparecen en el Dashboard',
        'Servicios inactivos no se muestran a los clientes'
      ],
      steps: [
        { title: 'Entra al módulo', description: 'Menú lateral → "Servicios"' },
        { title: 'Explora', description: 'Revisa las tarjetas del catálogo' },
        { title: 'Abre un servicio', description: 'Click en la tarjeta para ir al formulario' }
      ]
    },
    {
      id: 'services-dynamic-form',
      name: 'Formulario Dinámico por Etapas',
      description: 'Llenar la solicitud paso a paso',
      roles: ['client', 'corporate_client', 'basic'],
      content: `
        <p>Cada servicio tiene un formulario dividido en <strong>etapas</strong>. Cada etapa agrupa campos relacionados, con validaciones y textos de ayuda.</p>
      `,
      features: [
        'Etapas secuenciales con navegación anterior/siguiente',
        'Tipos de campo: texto, textarea, número, fecha, email, selector, archivo múltiple',
        'Texto de ayuda (help text) encima del input',
        'Validación por tipo y por obligatoriedad',
        'Archivos múltiples: contador X/10, botón × para quitar archivo individual, tamaño máximo por archivo',
        'Botón "Siguiente" deshabilitado hasta completar campos obligatorios de la etapa'
      ],
      tips: [
        'Lee el help text antes de llenar un campo — muchos servicios tienen requisitos específicos',
        'Puedes subir múltiples archivos en un solo campo (hasta 10); se listan como tarjetas con nombre y tamaño',
        'Si un archivo supera el límite, aparece el error inmediatamente'
      ]
    },
    {
      id: 'services-drafts',
      name: 'Borradores y Reanudar',
      description: 'Guardar progreso y continuar después',
      roles: ['client', 'corporate_client', 'basic'],
      content: `
        <p>Puedes guardar tu avance en cualquier momento. Al volver al servicio, el sistema carga el último borrador automáticamente.</p>
      `,
      features: [
        'Guardar borrador desde cualquier etapa',
        'Recuperación automática al volver al servicio',
        'Un borrador activo por servicio y usuario',
        'Envío final convierte el borrador en solicitud oficial'
      ],
      steps: [
        { title: 'Llena lo que puedas', description: 'Avanza por las etapas del formulario' },
        { title: 'Click en "Guardar borrador"', description: 'Tu progreso queda almacenado' },
        { title: 'Regresa cuando quieras', description: 'Al abrir el servicio, el borrador se carga automáticamente' },
        { title: 'Envía cuando esté listo', description: 'Click en "Enviar solicitud" para radicar' }
      ],
      tips: [
        'Guarda borrador antes de cerrar el navegador',
        'Solo un borrador activo por servicio — enviar o empezar uno nuevo reemplaza el anterior'
      ]
    },
    {
      id: 'services-submission',
      name: 'Envío y Radicado',
      description: 'Radicar la solicitud oficialmente',
      roles: ['client', 'corporate_client', 'basic'],
      content: `
        <p>Al enviar la solicitud se genera un número de radicado <strong><code>AÑO-CONSECUTIVO</code></strong> (ej: <code>2026-00123</code>), un PDF corporativo con el resumen y se notifica por email a los abogados encargados.</p>
      `,
      features: [
        'Radicado automático <code>YYYY-NNNNN</code> único por año',
        'PDF corporativo con header, metadatos, secciones, aviso legal y footer',
        'Email de confirmación al solicitante con radicado y PDF adjunto',
        'Email de notificación a los abogados/admin encargados',
        'Solicitud visible inmediatamente en "Mis Solicitudes"'
      ],
      restrictions: [
        'Una vez enviada, no puedes editar la solicitud — solo agregar información vía respuestas del hilo',
        'El borrador se elimina al enviarse'
      ]
    },
    {
      id: 'services-my-requests',
      name: 'Mis Solicitudes',
      description: 'Seguimiento de tus trámites en curso',
      roles: ['client', 'corporate_client', 'basic'],
      content: `
        <p>La pestaña "Mis Solicitudes" lista todas tus solicitudes enviadas con su estado actual y las respuestas del abogado.</p>
      `,
      features: [
        'Listado con radicado, servicio, fecha y estado',
        'Detalle completo con todas las respuestas del abogado',
        'Archivos adjuntos (tanto tuyos como del abogado) descargables',
        'Historial cronológico de cambios de estado',
        'Notificación por email cuando cambia el estado'
      ],
      steps: [
        { title: 'Abre "Mis Solicitudes"', description: 'Pestaña dentro de Servicios' },
        { title: 'Click en una solicitud', description: 'Abre el detalle con todas las respuestas' },
        { title: 'Descarga archivos', description: 'Cada respuesta puede traer archivos del abogado' }
      ],
      tips: [
        'Revisa el email que te enviamos con el radicado — es la forma más rápida de referenciar la solicitud',
        'Si el abogado solicita información adicional, responde desde el hilo de la solicitud'
      ]
    },
    {
      id: 'services-inbox',
      name: 'Bandeja de Solicitudes (Abogados)',
      description: 'Gestionar las solicitudes recibidas',
      roles: ['lawyer'],
      content: `
        <p>Los abogados reciben las solicitudes en la pestaña "Bandeja", donde pueden revisarlas, cambiar el estado, responder con archivos adjuntos y cerrar el caso.</p>
      `,
      features: [
        'Listado de solicitudes con radicado, servicio, solicitante y estado',
        'Filtrar por estado y por servicio',
        'Detalle con todo el formulario llenado por el cliente y archivos adjuntos',
        'Cambiar estado de la solicitud (En Revisión, Respondida, Cerrada, etc.)',
        'Responder al cliente con texto y archivos adjuntos',
        'Los adjuntos de la respuesta más reciente se envían al cliente por email'
      ],
      steps: [
        { title: 'Abre "Bandeja"', description: 'Pestaña visible solo para abogados' },
        { title: 'Click en una solicitud', description: 'Accede al detalle completo' },
        { title: 'Responde al cliente', description: 'Escribe tu respuesta y adjunta archivos si es necesario' },
        { title: 'Cambia el estado', description: 'Marca la solicitud como En Revisión / Respondida / Cerrada' }
      ],
      tips: [
        'Responde aunque no tengas avance completo — los clientes valoran saber que su caso fue recibido',
        'Los archivos de tu última respuesta se adjuntan al email de notificación',
        'Usa estados consistentes para que el cliente entienda en qué parte del proceso está'
      ]
    },
    {
      id: 'services-admin',
      name: 'Administración de Servicios',
      description: 'Crear y configurar servicios del catálogo',
      roles: ['lawyer'],
      content: `
        <p>La vista <strong>Services Admin</strong> (<code>/services_admin</code>, solo admins) permite crear y configurar los servicios del catálogo: etapas, campos, íconos y reglas.</p>
      `,
      features: [
        'Crear / editar servicios',
        'Configurar etapas y campos por etapa',
        'Tipos de campo: texto, textarea, número, fecha, email, selector, archivo',
        'Opciones para selectores (clave + etiqueta)',
        'Extensiones permitidas para archivos',
        'Vista previa del ícono (miniatura 80×80) con validación de 5MB',
        'Validación exhaustiva: nombres, claves duplicadas, opciones vacías, extensiones',
        'Toggle Activo/Inactivo y Destacado/No destacado',
        'Mensajes de error específicos del backend (extraídos de error.response.data)'
      ],
      steps: [
        { title: 'Abre Services Admin', description: 'Ruta /services_admin (requiere rol admin)' },
        { title: 'Crea un servicio', description: 'Define nombre, descripción, ícono y estado' },
        { title: 'Agrega etapas', description: 'Cada etapa agrupa campos relacionados' },
        { title: 'Configura los campos', description: 'Tipo, obligatoriedad, help text, opciones' },
        { title: 'Guarda y prueba', description: 'Activa el servicio y verifica que aparece en el catálogo' }
      ],
      tips: [
        'Usa claves técnicas sin espacios para los campos (ej: "razon_social")',
        'Agrupa campos relacionados en la misma etapa para mejor UX',
        'Marca servicios clave como destacados para que aparezcan en el Dashboard'
      ],
      restrictions: [
        'Solo accesible para usuarios con rol de administrador'
      ]
    }
  ]
};
