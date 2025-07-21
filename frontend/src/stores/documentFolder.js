import { defineStore } from 'pinia';
import {
  get_request,
  create_request,
  update_request,
  patch_request,
  delete_request
} from '@/stores/services/request_http';
import { getColorById, getAllColors } from '@/shared/color_palette';
import { showNotification } from '@/shared/notification_message';

export const useDocumentFolderStore = defineStore('documentFolder', {
  state: () => ({
    folders: [],
    currentFolder: null,
    isLoading: false,
    error: null,
    lastUpdatedFolderId: null
  }),

  getters: {
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
  },

  actions: {
    /**
     * Initialize the store and fetch all folders
     */
    async init(forceRefresh = false) {
      if (this.folders.length > 0 && !forceRefresh) {
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        await this.fetchFolders();
      } catch (error) {
        console.error('Error initializing document folder store:', error);
        this.error = 'Error al inicializar las carpetas';
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Fetch all folders from the API
     */
    async fetchFolders() {
      try {
        const response = await get_request('dynamic-documents/folders/');
        
        if (response.status === 200) {
          this.folders = response.data;
          return response.data;
        } else {
          throw new Error(`Error fetching folders: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching folders:', error);
        this.error = 'Error al obtener las carpetas';
        throw error;
      }
    },

    /**
     * Fetch a specific folder by ID
     */
    async fetchFolder(folderId) {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await get_request(`dynamic-documents/folders/${folderId}/`);
        
        if (response.status === 200) {
          const folder = response.data;
          
          // Update folder in store if it exists, otherwise add it
          const existingIndex = this.folders.findIndex(f => f.id === folder.id);
          if (existingIndex !== -1) {
            this.folders[existingIndex] = folder;
          } else {
            this.folders.push(folder);
          }
          
          this.currentFolder = folder;
          return folder;
        } else {
          throw new Error(`Error fetching folder: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching folder:', error);
        this.error = 'Error al obtener la carpeta';
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Create a new folder
     */
    async createFolder(folderData) {
      this.isLoading = true;
      this.error = null;

      try {
        // Validate required fields
        if (!folderData.name || folderData.name.trim() === '') {
          throw new Error('El nombre de la carpeta es requerido');
        }

        // Ensure color_id is valid
        const colorId = folderData.color_id ?? 0;
        if (colorId < 0 || colorId >= getAllColors().length) {
          throw new Error('Color de carpeta no válido');
        }

        const payload = {
          name: folderData.name.trim(),
          color_id: colorId,
          ...(folderData.document_ids && { document_ids: folderData.document_ids })
        };

        const response = await create_request('dynamic-documents/folders/create/', payload);
        
        if (response.status === 200 || response.status === 201) {
          const newFolder = response.data;
          this.folders.push(newFolder);
          this.lastUpdatedFolderId = newFolder.id;
          
          await showNotification('Carpeta creada exitosamente', 'success');
          return newFolder;
        } else {
          throw new Error(`Error creating folder: ${response.status}`);
        }
      } catch (error) {
        console.error('Error creating folder:', error);
        this.error = error.message || 'Error al crear la carpeta';
        await showNotification(this.error, 'error');
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update an existing folder
     */
    async updateFolder(folderId, folderData) {
      this.isLoading = true;
      this.error = null;

      try {
        // Validate required fields
        if (folderData.name && folderData.name.trim() === '') {
          throw new Error('El nombre de la carpeta no puede estar vacío');
        }

        // Validate color_id if provided
        if (folderData.color_id !== undefined) {
          const colorId = folderData.color_id;
          if (colorId < 0 || colorId >= getAllColors().length) {
            throw new Error('Color de carpeta no válido');
          }
        }

        const payload = {};
        if (folderData.name) payload.name = folderData.name.trim();
        if (folderData.color_id !== undefined) payload.color_id = folderData.color_id;
        if (folderData.document_ids !== undefined) payload.document_ids = folderData.document_ids;

        const response = await patch_request(`dynamic-documents/folders/${folderId}/update/`, payload);
        
        if (response.status === 200) {
          const updatedFolder = response.data;
          
          // Update folder in store
          const index = this.folders.findIndex(f => f.id === folderId);
          if (index !== -1) {
            this.folders[index] = updatedFolder;
          }
          
          // Update current folder if it's the one being updated
          if (this.currentFolder && this.currentFolder.id === folderId) {
            this.currentFolder = updatedFolder;
          }
          
          this.lastUpdatedFolderId = folderId;
          
          await showNotification('Carpeta actualizada exitosamente', 'success');
          return updatedFolder;
        } else {
          throw new Error(`Error updating folder: ${response.status}`);
        }
      } catch (error) {
        console.error('Error updating folder:', error);
        this.error = error.message || 'Error al actualizar la carpeta';
        await showNotification(this.error, 'error');
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Delete a folder
     */
    async deleteFolder(folderId) {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await delete_request(`dynamic-documents/folders/${folderId}/delete/`);
        
        if (response.status === 204 || response.status === 200) {
          // Remove folder from store
          this.folders = this.folders.filter(f => f.id !== folderId);
          
          // Clear current folder if it was the deleted one
          if (this.currentFolder && this.currentFolder.id === folderId) {
            this.currentFolder = null;
          }
          
          await showNotification('Carpeta eliminada exitosamente', 'success');
          return true;
        } else {
          throw new Error(`Error deleting folder: ${response.status}`);
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
        this.error = error.message || 'Error al eliminar la carpeta';
        await showNotification(this.error, 'error');
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Add documents to a folder
     */
    async addDocumentsToFolder(folderId, documentIds) {
      const folder = this.getFolderById(folderId);
      if (!folder) {
        throw new Error('Carpeta no encontrada');
      }

      const currentDocumentIds = folder.document_ids || [];
      const newDocumentIds = [...new Set([...currentDocumentIds, ...documentIds])];

      return await this.updateFolder(folderId, {
        document_ids: newDocumentIds
      });
    },

    /**
     * Remove documents from a folder
     */
    async removeDocumentsFromFolder(folderId, documentIds) {
      const folder = this.getFolderById(folderId);
      if (!folder) {
        throw new Error('Carpeta no encontrada');
      }

      const currentDocumentIds = folder.document_ids || [];
      const newDocumentIds = currentDocumentIds.filter(id => !documentIds.includes(id));

      return await this.updateFolder(folderId, {
        document_ids: newDocumentIds
      });
    },

    /**
     * Move documents between folders
     */
    async moveDocumentsBetweenFolders(documentIds, fromFolderId, toFolderId) {
      try {
        // Remove from source folder if specified
        if (fromFolderId) {
          await this.removeDocumentsFromFolder(fromFolderId, documentIds);
        }

        // Add to destination folder
        if (toFolderId) {
          await this.addDocumentsToFolder(toFolderId, documentIds);
        }

        await showNotification('Documentos movidos exitosamente', 'success');
      } catch (error) {
        console.error('Error moving documents between folders:', error);
        await showNotification('Error al mover documentos', 'error');
        throw error;
      }
    },

    /**
     * Set current folder
     */
    setCurrentFolder(folder) {
      this.currentFolder = folder;
    },

    /**
     * Clear current folder
     */
    clearCurrentFolder() {
      this.currentFolder = null;
    },

    /**
     * Reset store state
     */
    reset() {
      this.folders = [];
      this.currentFolder = null;
      this.isLoading = false;
      this.error = null;
      this.lastUpdatedFolderId = null;
    },

    /**
     * Get folder color information
     */
    getFolderColor(folderId) {
      const folder = this.getFolderById(folderId);
      return folder ? getColorById(folder.color_id) : getColorById(0);
    },

    /**
     * Validate folder data before operations
     */
    validateFolderData(folderData) {
      const errors = [];

      if (!folderData.name || folderData.name.trim() === '') {
        errors.push('El nombre de la carpeta es requerido');
      }

      if (folderData.name && folderData.name.length > 100) {
        errors.push('El nombre de la carpeta no puede exceder 100 caracteres');
      }

      if (folderData.color_id !== undefined) {
        const colorId = folderData.color_id;
        if (colorId < 0 || colorId >= getAllColors().length) {
          errors.push('Color de carpeta no válido');
        }
      }

      if (folderData.document_ids && !Array.isArray(folderData.document_ids)) {
        errors.push('Los IDs de documentos deben ser un array');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    }
  }
}); 