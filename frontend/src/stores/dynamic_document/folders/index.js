import { defineStore } from 'pinia';
import { initialState } from './state';
import { getters } from './getters';
import { actions } from './actions';
import { utilityActions } from './utilities';

/**
 * Document Folders Store
 * 
 * Modular store for managing document folders with separated concerns:
 * - Folder CRUD operations
 * - Document organization within folders
 * - Color management for folders
 * - Validation and utilities
 */
export const useDocumentFolderStore = defineStore('documentFolder', {
  /**
   * Store state definition
   */
  state: initialState,

  /**
   * Store getters
   */
  getters: getters,

  /**
   * Store actions - combining all actions from different modules
   */
  actions: {
    ...actions,
    ...utilityActions,
  },
});