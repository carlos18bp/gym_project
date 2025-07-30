import { getColorById, getAllColors } from '@/shared/color_palette';
import { showNotification } from '@/shared/notification_message';

/**
 * Utility actions and helpers for document folders
 */
export const utilityActions = {
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
};