import { defineStore } from "pinia";
import { initialState } from "./state";
import { getters } from "./getters";
import { filterGetters } from "./filters";
import { documentActions } from "./documents";
import { tagActions } from "./tags";
import { permissionActions } from "./permissions";

/**
 * Dynamic Document Store
 * 
 * Modular store for managing dynamic documents with separated concerns:
 * - Document CRUD operations
 * - Tag management
 * - Permission management
 * - Filtering and search
 * - Pagination
 */
export const useDynamicDocumentStore = defineStore("dynamicDocument", {
  /**
   * Store state definition
   */
  state: initialState,

  /**
   * Store getters - combining all getters from different modules
   */
  getters: {
    ...getters,
    ...filterGetters,
  },

  /**
   * Store actions - combining all actions from different modules
   */
  actions: {
    ...documentActions,
    ...tagActions,
    ...permissionActions,
  },
});