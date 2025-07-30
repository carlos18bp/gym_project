/**
 * Centralized state definition for document folders store
 */
export const initialState = () => ({
  folders: [],
  currentFolder: null,
  isLoading: false,
  error: null,
  lastUpdatedFolderId: null
});