import { getColorById, getAllColors } from '@/shared/color_palette';

/**
 * Getters for document folders store
 */
export const getters = {
  /**
   * Get all folders sorted by creation date (newest first)
   */
  sortedFolders: (state) => {
    return [...state.folders].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  },

  /**
   * Get folder by ID
   */
  getFolderById: (state) => {
    return (folderId) => state.folders.find(folder => folder.id === folderId);
  },

  /**
   * Get folders by color
   */
  getFoldersByColor: (state) => {
    return (colorId) => state.folders.filter(folder => folder.color_id === colorId);
  },

  /**
   * Get folder with color information
   */
  getFolderWithColor: (state) => {
    return (folderId) => {
      const folder = state.folders.find(folder => folder.id === folderId);
      if (!folder) return null;
      
      return {
        ...folder,
        color: getColorById(folder.color_id)
      };
    };
  },

  /**
   * Get folders that contain a specific document
   */
  getFoldersContainingDocument: (state) => {
    return (documentId) => {
      return state.folders.filter(folder => 
        folder.document_ids && folder.document_ids.includes(documentId)
      );
    };
  },

  /**
   * Get total number of documents across all folders
   */
  totalDocumentsInFolders: (state) => {
    return state.folders.reduce((total, folder) => 
      total + (folder.document_ids ? folder.document_ids.length : 0), 0
    );
  },

  /**
   * Check if any folders exist
   */
  hasFolders: (state) => state.folders.length > 0,

  /**
   * Get available colors for folders
   */
  availableColors: () => getAllColors()
};