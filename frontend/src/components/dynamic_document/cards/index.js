// Cards Components
export { default as BaseDocumentCard } from './BaseDocumentCard.vue';
export { default as DocumentCard } from './DocumentCard.vue';
export { default as UseDocumentCard } from './UseDocumentCard.vue';
export { default as SignatureDocumentCard } from './SignatureDocumentCard.vue';
export { default as FolderCard } from './FolderCard.vue';

// Modal Components
export { default as EditDocumentModal } from './modals/EditDocumentModal.vue';
export { default as SendDocumentModal } from './modals/SendDocumentModal.vue';
export { default as DocumentPreviewModal } from './modals/DocumentPreviewModal.vue';
export { default as DocumentSignaturesModal } from './modals/DocumentSignaturesModal.vue';
export { default as ElectronicSignatureModal } from './modals/ElectronicSignatureModal.vue';
export { default as DocumentPermissionsModal } from './modals/DocumentPermissionsModal.vue';

// Modal Manager Composable
import { ref } from 'vue';
import { openPreviewModal } from "@/shared/document_utils";
import { useUserStore } from "@/stores/user";

/**
 * Composable for managing card modals centrally
 * Handles all modal states and actions within cards
 */
export function useCardModals(documentStore, userStore) {
  // Modal states
  const activeModals = ref({
    edit: { isOpen: false, document: null },
    email: { isOpen: false, document: null },
    preview: { isOpen: false, document: null },
    signatures: { isOpen: false, document: null },
    electronicSignature: { isOpen: false, document: null },
    permissions: { isOpen: false, document: null }
  });

  /**
   * Open a modal with document data
   */
  const openModal = (type, document, options = {}) => {
    // Close any other open modals first
    closeAllModals();
    
    switch (type) {
      case 'edit':
        activeModals.value.edit = { isOpen: true, document, ...options };
        break;
        
      case 'email':
        activeModals.value.email = { isOpen: true, document };
        break;
        
      case 'preview':
        // Use existing preview modal system
        openPreviewModal(document);
        break;
        
      case 'signatures':
        activeModals.value.signatures = { isOpen: true, document };
        break;
        
      case 'electronic-signature':
        activeModals.value.electronicSignature = { isOpen: true, document };
        break;
        
      case 'permissions':
        activeModals.value.permissions = { isOpen: true, document };
        break;
        
      default:
        console.warn(`Unknown modal type: ${type}`);
    }
  };

  /**
   * Close a specific modal
   */
  const closeModal = (type) => {
    if (activeModals.value[type]) {
      activeModals.value[type] = { isOpen: false, document: null };
    }
  };

  /**
   * Close all modals
   */
  const closeAllModals = () => {
    Object.keys(activeModals.value).forEach(type => {
      activeModals.value[type] = { isOpen: false, document: null };
    });
  };

  /**
   * Get current user role
   */
  const getUserRole = () => {
    return userStore?.currentUser?.role || 'client';
  };

  return {
    activeModals,
    openModal,
    closeModal,
    closeAllModals,
    getUserRole
  };
}

// Action Handlers - Extracted from BaseDocumentCard
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import { get_request, create_request } from "@/stores/services/request_http";
import { useRecentViews } from '@/composables/useRecentViews';
import { useRouter } from 'vue-router';
import { downloadFile } from "@/shared/document_utils";

/**
 * Document Actions Composable
 * Centralizes all document action handlers
 */
export function useDocumentActions(documentStore, userStore, emit) {
  const { registerView } = useRecentViews();
  const router = useRouter();

  /**
   * Handle preview document
   */
  const handlePreviewDocument = async (document) => {
    await registerView('document', document.id);
    openPreviewModal(document);
  };

  /**
   * Delete document
   */
  const deleteDocument = async (document) => {
    const confirmed = await showConfirmationAlert(
      `¿Estás seguro de que deseas eliminar el documento "${document.title}"?`
    );

    if (confirmed && documentStore) {
      try {
        await documentStore.deleteDocument(document.id);
        await showNotification('Documento eliminado exitosamente', 'success');
        emit('refresh');
      } catch (error) {
        await showNotification('Error al eliminar el documento', 'error');
        throw error;
      }
    }
  };

  /**
   * Download PDF document
   */
  const downloadPDFDocument = async (document) => {
    if (!documentStore) return;
    
    try {
      await documentStore.downloadPDF(document.id, document.title);
      await showNotification('PDF descargado exitosamente', 'success');
    } catch (error) {
      await showNotification('Error al descargar el PDF', 'error');
      throw error;
    }
  };

  /**
   * Download Word document
   */
  const downloadWordDocument = async (document) => {
    if (!documentStore) return;
    
    try {
      await documentStore.downloadWord(document.id, document.title);
      await showNotification('Documento Word descargado exitosamente', 'success');
    } catch (error) {
      await showNotification('Error al descargar el documento Word', 'error');
      throw error;
    }
  };

  /**
   * Copy document
   */
  const copyDocument = async (document) => {
    if (!documentStore) {
      await showNotification('Funcionalidad de duplicar no implementada aún', 'info');
      return;
    }

    try {
      // Generate current date in ddmmyyyy format
      const currentDate = new Date();
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();
      const dateString = `${day}${month}${year}`;
      
      // Create new title with date suffix
      const newTitle = `${document.title} ${dateString}`;
      
      // Prepare document data for copy
      const copyData = {
        title: newTitle,
        content: document.content,
        state: "Draft", // Always create copy as draft
        variables: document.variables?.map(variable => ({
          name_en: variable.name_en,
          name_es: variable.name_es,
          tooltip: variable.tooltip,
          field_type: variable.field_type,
          select_options: variable.select_options,
          value: "", // Reset values in copy
        })) || [],
        requires_signature: false, // Reset signature requirement
      };
      
      // Show confirmation
      const confirmed = await showConfirmationAlert(
        `¿Deseas crear una copia del documento '${document.title}'?`
      );
      
      if (!confirmed) {
        return;
      }
      
      // Create the copy using the document store
      await documentStore.createDocument(copyData);
      await showNotification(`Copia creada exitosamente: "${newTitle}"`, "success");
      emit('refresh');
      
    } catch (error) {
      console.error("Error creating document copy:", error);
      await showNotification("Error al crear la copia del documento", "error");
    }
  };

  /**
   * Publish document
   */
  const publishDocument = async (document) => {
    if (!documentStore) return;
    
    try {
      const updatedData = { ...document, state: "Published" };
      await documentStore.updateDocument(document.id, updatedData);
      await showNotification('Documento publicado exitosamente', 'success');
      emit('refresh');
    } catch (error) {
      await showNotification('Error al publicar el documento', 'error');
      throw error;
    }
  };

  /**
   * Move document to draft
   */
  const moveToDraft = async (document) => {
    if (!documentStore) return;
    
    try {
      const updatedData = { ...document, state: "Draft" };
      await documentStore.updateDocument(document.id, updatedData);
      await showNotification('Documento movido a borrador exitosamente', 'success');
      emit('refresh');
    } catch (error) {
      await showNotification('Error al mover el documento a borrador', 'error');
      throw error;
    }
  };

  /**
   * Formalize document with signatures
   */
  const formalizeDocument = async (document) => {
    try {
      router.push(`/dynamic_document_dashboard/document/use/formalize/${document.id}/${document.title}`);
    } catch (error) {
      console.error('Error al formalizar el documento:', error);
      await showNotification('Error al formalizar el documento', 'error');
    }
  };

  /**
   * Sign document
   */
  const signDocument = async (document, openModalFn) => {
    try {
      const userId = userStore.currentUser.id;
      const userEmail = userStore.currentUser.email;
      
      if (!document.requires_signature) {
        await showNotification("Este documento no requiere firmas", "error");
        return;
      }
      
      const currentUserSignature = document.signatures?.find(s => s.signer_email === userEmail);
      
      if (!currentUserSignature) {
        await showNotification("No estás autorizado para firmar este documento", "error");
        return;
      }
      
      if (currentUserSignature.signed) {
        await showNotification("Ya has firmado este documento", "info");
        return;
      }
      
      if (!userStore.currentUser.has_signature) {
        await showNotification("Para firmar documentos necesitas tener una firma registrada.", "info");
        
        const createSignature = await showConfirmationAlert(
          "¿Deseas crear una firma electrónica ahora?"
        );
        
        if (createSignature) {
          openModalFn('electronic-signature', document);
        } else {
          await showNotification("Necesitas una firma para poder firmar documentos.", "warning");
        }
        return;
      }

      const confirmed = await showConfirmationAlert(
        `¿Estás seguro de que deseas firmar el documento "${document.title}"?`
      );

      if (!confirmed) {
        await showNotification("Operación de firma cancelada", "info");
        return;
      }

      const signUrl = `dynamic-documents/${document.id}/sign/${userId}/`;
      
      try {
        await showNotification("Procesando firma del documento...", "info");
        
        const response = await create_request(signUrl, {});
        
        if (response.status === 200 || response.status === 201) {
          await showNotification(`¡Documento "${document.title}" firmado correctamente!`, "success");
          emit('refresh');
        } else {
          throw new Error(`Unexpected server response: ${response.status} ${response.statusText}`);
        }
      } catch (requestError) {
        console.error('Error in HTTP request:', requestError);
        throw requestError;
      }
    } catch (error) {
      console.error('General error signing document:', error);
      await showNotification(`Error al firmar el documento: ${error.message}`, "error");
    }
  };

  /**
   * Download signed document with signatures information
   */
  const downloadSignedDocument = async (document) => {
    try {
      if (document.state !== 'FullySigned') {
        showNotification('El documento debe estar completamente firmado para descargarlo', 'warning');
        return;
      }

      if (!document.signatures || document.signatures.length === 0) {
        showNotification('El documento no tiene firmas registradas', 'warning');
        return;
      }

      const url = `dynamic-documents/${document.id}/generate-signatures-pdf/`;
      await downloadFile(url, `firmas_${document.title}.pdf`);
      
    } catch (error) {
      console.error('Error downloading signed document:', error);
      showNotification('Error al descargar el documento firmado', 'error');
    }
  };

  return {
    handlePreviewDocument,
    deleteDocument,
    downloadPDFDocument,
    downloadWordDocument,
    copyDocument,
    publishDocument,
    moveToDraft,
    formalizeDocument,
    signDocument,
    downloadSignedDocument
  };
} 