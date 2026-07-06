/**
 * Guided tour registry.
 *
 * Maps a backend module identifier to its tour configuration.  To add a
 * tour for another module (Procesos, Solicitudes, ...), create a
 * `<module>_steps.js` file next to this one and register it here — the
 * `useGuidedTour` composable and the TourProgress API are module-agnostic.
 */

import {
  MODULE_NAME as DYNAMIC_DOCUMENTS_MODULE,
  CONFIRM_MESSAGE as DYNAMIC_DOCUMENTS_CONFIRM,
  getTourSteps as getDynamicDocumentsSteps,
} from './dynamic_documents_steps';

export const tourRegistry = {
  [DYNAMIC_DOCUMENTS_MODULE]: {
    getSteps: getDynamicDocumentsSteps,
    confirmMessage: DYNAMIC_DOCUMENTS_CONFIRM,
  },
};

/**
 * @param {string} module - backend module identifier
 * @returns {{getSteps: Function, confirmMessage: string}|null}
 */
export function getTourConfig(module) {
  return tourRegistry[module] || null;
}
