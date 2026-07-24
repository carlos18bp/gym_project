/**
 * Guided tour registry.
 *
 * Maps a backend module identifier to its tour configuration.  To add a
 * tour for another module (Procesos, Solicitudes, ...), create a
 * `<module>_steps.js` file next to this one and register it here — the
 * `useGuidedTour` composable and the TourProgress API are module-agnostic.
 *
 * `intro`, `finale` and `eyebrow` are optional per module: a module
 * without them simply gets its content steps with no framing cards.
 */

import {
  MODULE_NAME as DYNAMIC_DOCUMENTS_MODULE,
  CONFIRM_MESSAGE as DYNAMIC_DOCUMENTS_CONFIRM,
  EYEBROW_LABEL as DYNAMIC_DOCUMENTS_EYEBROW,
  WELCOME_STEP as DYNAMIC_DOCUMENTS_WELCOME,
  FINAL_STEP as DYNAMIC_DOCUMENTS_FINALE,
  getTourSteps as getDynamicDocumentsSteps,
} from './dynamic_documents_steps';

export const tourRegistry = {
  [DYNAMIC_DOCUMENTS_MODULE]: {
    getSteps: getDynamicDocumentsSteps,
    confirmMessage: DYNAMIC_DOCUMENTS_CONFIRM,
    eyebrow: DYNAMIC_DOCUMENTS_EYEBROW,
    intro: DYNAMIC_DOCUMENTS_WELCOME,
    finale: DYNAMIC_DOCUMENTS_FINALE,
  },
};

/**
 * @param {string} module - backend module identifier
 * @returns {{getSteps: Function, confirmMessage: string, eyebrow?: string, intro?: object, finale?: object}|null}
 */
export function getTourConfig(module) {
  return tourRegistry[module] || null;
}
