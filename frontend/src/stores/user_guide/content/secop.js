import { BriefcaseIcon } from '@heroicons/vue/24/outline';

export const secopContent = {
  name: 'SECOP — Contratación Estatal',
  icon: BriefcaseIcon,
  description: 'Consulta y seguimiento de procesos de contratación pública (SECOP)',
  overview: `
    <p>El módulo SECOP integra datos en vivo de <strong>datos.gov.co</strong> para consultar procesos de contratación pública en Colombia.</p>
    <p class="mt-2">Permite buscar, clasificar, crear alertas personalizadas, guardar vistas con filtros frecuentes y exportar a Excel los procesos relevantes para tu práctica.</p>
  `,
  sections: [
    {
      id: 'secop-tabs',
      name: 'Pestañas de SECOP',
      description: 'Organización de los procesos en tres vistas',
      roles: ['lawyer', 'client', 'corporate_client', 'basic'],
      content: `
        <p>El listado de SECOP se organiza en tres pestañas:</p>
      `,
      features: [
        'Todos: catálogo completo sincronizado desde datos.gov.co',
        'Clasificados: procesos que marcaste con un estado de interés (contador visible)',
        'Alertas: procesos que coincidieron con tus criterios de alerta (contador visible)'
      ],
      restrictions: [
        'El rol básico ve el módulo con un overlay que limita algunas acciones — actívalo mejorando tu plan'
      ]
    },
    {
      id: 'secop-search-filters',
      name: 'Búsqueda y Filtros',
      description: 'Encontrar procesos relevantes',
      roles: ['lawyer', 'client', 'corporate_client', 'basic'],
      content: `
        <p>La búsqueda opera sobre entidad, objeto y número de referencia. Los filtros avanzados permiten afinar los resultados por departamento, modalidad, estado, entidad y códigos UNSPSC.</p>
      `,
      features: [
        'Búsqueda de texto libre (entidad, objeto, referencia)',
        'Palabras clave como tags: presiona Enter para agregar y click en × para eliminar',
        'Filtros múltiples: Departamento, Modalidad, Estado, Entidad',
        'Filtro UNSPSC multi-select con comportamiento de unión',
        'Combinación: UNSPSC + palabras clave operan en conjunto',
        'Toggle de "Filtros avanzados" con contador de filtros activos',
        'Orden configurable por fecha o valor'
      ],
      tips: [
        'Usa palabras clave cortas y específicas; varias palabras actúan como OR',
        'Combina código UNSPSC con palabras clave para precisión alta',
        'Guarda tus filtros frecuentes en "Vistas Guardadas" para reutilizarlos'
      ]
    },
    {
      id: 'secop-classifications',
      name: 'Clasificar Procesos',
      description: 'Organizar procesos de interés por estado propio',
      roles: ['lawyer', 'client', 'corporate_client'],
      content: `
        <p>Cada usuario puede <strong>clasificar</strong> procesos con un estado propio que no depende del estado oficial del proceso en SECOP.</p>
      `,
      features: [
        'Estados: Interesante, En Revisión, Aplicado, Descartado',
        'Cambio de estado desde el detalle o desde la tabla',
        'Pestaña "Clasificados" filtrable por estado',
        'Remover clasificación en cualquier momento',
        'Útil para llevar un pipeline propio de oportunidades'
      ],
      steps: [
        { title: 'Abre un proceso', description: 'Click en una fila del listado' },
        { title: 'Asigna un estado', description: 'Usa el selector de clasificación en el detalle' },
        { title: 'Consulta tu pipeline', description: 'Pestaña "Clasificados" con filtro por estado' }
      ],
      tips: [
        'Usa "Interesante" como bandeja de entrada y mueve a "En Revisión" cuando empieces a analizar',
        'Descartados se mantienen para no revisarlos dos veces'
      ]
    },
    {
      id: 'secop-alerts',
      name: 'Alertas Personalizadas',
      description: 'Recibir notificaciones cuando aparezcan procesos de tu interés',
      roles: ['lawyer', 'client', 'corporate_client'],
      content: `
        <p>Las alertas evalúan automáticamente los procesos que entran al sistema contra tus criterios y marcan coincidencias en la pestaña "Alertas".</p>
      `,
      features: [
        'Nombre de la alerta',
        'Criterios combinables: palabras clave, departamento, modalidad, rango de presupuesto, UNSPSC',
        'Activar/Desactivar sin eliminar',
        'Contador de coincidencias en la pestaña "Alertas"',
        'Notificación por email cuando aparecen coincidencias nuevas',
        'Editar criterios sin perder historial'
      ],
      steps: [
        { title: 'Abre "Alertas"', description: 'Pestaña Alertas → botón "Nueva Alerta"' },
        { title: 'Define criterios', description: 'Nombre, palabras clave, filtros' },
        { title: 'Guarda', description: 'La alerta empieza a evaluar los siguientes procesos sincronizados' },
        { title: 'Revisa coincidencias', description: 'Entra a la alerta para ver los procesos que cumplen' }
      ],
      tips: [
        'Evita criterios demasiado amplios; generan mucho ruido',
        'Incluye rango de presupuesto para filtrar oportunidades alineadas a tu capacidad'
      ],
      restrictions: [
        'El rango de presupuesto acepta null (sin tope) — el sistema maneja presupuestos incompletos correctamente'
      ]
    },
    {
      id: 'secop-saved-views',
      name: 'Vistas Guardadas',
      description: 'Guardar combinaciones de filtros frecuentes',
      roles: ['lawyer', 'client', 'corporate_client'],
      content: `
        <p>Las <strong>vistas guardadas</strong> permiten persistir una combinación de filtros (búsqueda, departamento, UNSPSC, etc.) para aplicarla con un solo click.</p>
      `,
      features: [
        'Crear vista a partir de los filtros actuales',
        'Editar: renombrar y actualizar filtros',
        'Marcar como favorita (se aplica automáticamente al entrar al módulo)',
        'Eliminar vistas obsoletas',
        'Aplicar con un click desde el panel lateral'
      ],
      steps: [
        { title: 'Configura filtros', description: 'Aplica los filtros que quieres persistir' },
        { title: 'Guarda la vista', description: 'Click en "Guardar Vista" → nombre' },
        { title: 'Aplica cuando la necesites', description: 'Desde el panel de vistas guardadas' }
      ],
      tips: [
        'La vista favorita ahorra tiempo si consultas SECOP con los mismos filtros a diario',
        'Renombra vistas descriptivamente: "Alcaldías Antioquia - TI" es mejor que "Vista 1"'
      ]
    },
    {
      id: 'secop-export-sync',
      name: 'Exportar Excel y Sincronización',
      description: 'Descargar resultados y ver estado del sync',
      roles: ['lawyer', 'client', 'corporate_client'],
      content: `
        <p>Los resultados filtrados pueden exportarse a Excel. El sync con datos.gov.co es automático, pero también puede dispararse manualmente.</p>
      `,
      features: [
        'Exportar a Excel el resultado actual (respeta los filtros aplicados)',
        'Indicador de estado de sincronización (última actualización)',
        'Botón para forzar un sync manual',
        'Limpieza automática post-sync de procesos "Abierto" con fecha de cierre vencida'
      ],
      tips: [
        'Exporta antes de cerrar el navegador si vas a trabajar el listado offline',
        'Forzar sync manual es útil solo si esperas un proceso recién publicado que no aparece'
      ]
    }
  ]
};
