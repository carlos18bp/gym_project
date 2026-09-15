/**
 * Guided tour step definitions for the "Archivos Jurídicos" module.
 *
 * Step shape:
 * - target      CSS selector, always a stable `[data-tour="..."]` attribute
 * - tab         Dashboard tab that must be active for the target to exist
 *               (null when the target is always rendered); the composable
 *               switches to this tab before highlighting the step
 * - desktopOnly true for targets that live inside the collapsed mobile
 *               dropdown (individual tab buttons) and are dropped at <md
 * - popover     driver.js popover config (Spanish user-facing copy)
 */

export const MODULE_NAME = 'dynamic_documents';

export const CONFIRM_MESSAGE =
  '¿Quieres ver la guía del módulo de Archivos Jurídicos?';

// Small-caps context label rendered above every popover title.
export const EYEBROW_LABEL = 'Guía · Archivos Jurídicos';

// Element-less opening card: driver.js renders steps without a target as
// a centered modal-style popover. Not counted in the "Paso X de Y" math.
export const WELCOME_STEP = {
  target: null,
  tab: null,
  desktopOnly: false,
  popover: {
    title: 'Bienvenido a Archivos Jurídicos',
    description:
      'En este breve recorrido conocerás las secciones del módulo y las acciones principales para crear, organizar y firmar tus documentos. Puedes salir en cualquier momento.',
    nextBtnText: 'Comenzar recorrido',
  },
};

// Functional closing card: highlights the permanent "?" help button so
// the tour ends by teaching the user how to bring it back.
export const FINAL_STEP = {
  target: '[data-tour="help-button"]',
  tab: null,
  desktopOnly: false,
  popover: {
    title: 'Hasta aquí el recorrido',
    description:
      'Si más adelante necesitas repasar estos pasos, puedes repetir esta guía cuando quieras desde este botón de ayuda.',
    doneBtnText: 'Entendido',
    side: 'bottom',
    align: 'end',
  },
};

const LAWYER_STEPS = [
  {
    target: '[data-tour="tabs-nav"]',
    tab: null,
    desktopOnly: false,
    popover: {
      title: 'Pestañas de navegación',
      description:
        'Desde estas pestañas accedes a todas las secciones del módulo: minutas, carpetas, tus documentos y los documentos de tus clientes.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-legal-documents"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Minutas',
      description:
        'Aquí creas y administras tus minutas (plantillas de documentos). Al publicarlas quedan disponibles para generar documentos.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="btn-new-minuta"]',
    tab: 'legal-documents',
    desktopOnly: false,
    popover: {
      title: 'Nueva Minuta',
      description:
        'Con este botón creas una minuta desde cero usando el editor de texto, con variables que luego se completan por documento.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    target: '[data-tour="tab-my-documents"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Mis Documentos',
      description:
        'En esta pestaña ves y administras los documentos que has creado a partir de tus minutas.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="btn-new-document"]',
    tab: 'my-documents',
    desktopOnly: false,
    popover: {
      title: 'Nuevo Documento',
      description:
        'Crea un documento a partir de una minuta publicada y asígnalo a un cliente para que complete su información.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    target: '[data-tour="tab-pending-signatures"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Documentos por firmar',
      description:
        'Aquí encuentras los documentos que están pendientes de tu firma o de la firma de otros participantes.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-folders"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Carpetas',
      description:
        'Organiza tus documentos en carpetas para encontrarlos más rápido.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-finished-documents"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Documentos de clientes',
      description:
        'Consulta los documentos que tus clientes ya completaron y formalizaron.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="btn-electronic-signature"]',
    tab: null,
    desktopOnly: false,
    popover: {
      title: 'Firma Electrónica',
      description:
        'Configura aquí tu firma electrónica: dibújala o súbela una vez y úsala para firmar documentos.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    target: '[data-tour="btn-global-letterhead"]',
    tab: null,
    desktopOnly: false,
    popover: {
      title: 'Membrete Global',
      description:
        'Sube un membrete que se aplicará a todos tus documentos al descargarlos o imprimirlos.',
      side: 'bottom',
      align: 'center',
    },
  },
];

const CLIENT_STEPS = [
  {
    target: '[data-tour="tabs-nav"]',
    tab: null,
    desktopOnly: false,
    popover: {
      title: 'Pestañas de navegación',
      description:
        'Desde estas pestañas accedes a todas las secciones del módulo: carpetas, tus documentos y los documentos por firmar.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-folders"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Carpetas',
      description:
        'Organiza tus documentos en carpetas para encontrarlos más rápido.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-my-documents"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Mis Documentos',
      description:
        'En esta pestaña ves los documentos que tienes asignados y completas la información que te soliciten.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-pending-signatures"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Documentos por firmar',
      description:
        'Aquí encuentras los documentos que están pendientes de tu firma electrónica.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="tab-signed-documents"]',
    tab: null,
    desktopOnly: true,
    popover: {
      title: 'Documentos formalizados',
      description:
        'Consulta los documentos que ya fueron firmados por todos los participantes.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    target: '[data-tour="btn-new-document"]',
    tab: null,
    desktopOnly: false,
    popover: {
      title: 'Nuevo Documento',
      description:
        'Crea un documento a partir de una minuta publicada por tu abogado y completa la información solicitada.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    target: '[data-tour="btn-electronic-signature"]',
    tab: null,
    desktopOnly: false,
    popover: {
      title: 'Firma Electrónica',
      description:
        'Configura aquí tu firma electrónica: dibújala o súbela una vez y úsala para firmar documentos.',
      side: 'bottom',
      align: 'center',
    },
  },
];

// Extra closing step shown only when the user has pending signatures.
// It reinforces the existing pending-signature alerts (tab badge + auto
// redirect) by ending the tour on that section.
const PENDING_SIGNATURES_STEP = {
  target: '[data-tour="tab-pending-signatures"]',
  tab: 'pending-signatures',
  desktopOnly: false,
  popover: {
    title: 'Tienes documentos por firmar',
    description:
      'Detectamos que tienes firmas pendientes. Revisa esta sección para completar tus firmas cuanto antes.',
    side: 'bottom',
    align: 'start',
  },
};

const LAWYER_LIKE_ROLES = ['lawyer', 'admin'];

/**
 * Build the raw step list for a role.
 *
 * @param {string} role - current user role ('lawyer', 'admin', 'client', 'basic', 'corporate_client')
 * @param {object} context - runtime flags, e.g. { hasPendingSignatures: true }
 * @returns {Array} step definitions (viewport/DOM filtering happens in the composable)
 */
export function getTourSteps(role, context = {}) {
  const base = LAWYER_LIKE_ROLES.includes(role) ? LAWYER_STEPS : CLIENT_STEPS;
  const steps = [...base];
  if (context.hasPendingSignatures) {
    steps.push(PENDING_SIGNATURES_STEP);
  }
  return steps;
}
