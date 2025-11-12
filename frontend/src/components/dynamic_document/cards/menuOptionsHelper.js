/**
 * Helper to generate menu options for document tables based on card type
 * Reuses the logic from BaseDocumentCard's cardConfigs
 */

/**
 * Check if document can be published
 */
function canPublishDocument(document) {
  if (!document.variables || document.variables.length === 0) {
    return true;
  }
  
  return document.variables.every((variable) => {
    return variable.name_es && variable.name_es.trim().length > 0;
  });
}

/**
 * Check if the current user can sign the document
 */
function canSignDocument(document, userStore) {
  if (!document.requires_signature || document.state !== 'PendingSignatures') {
    return false;
  }
  
  if (!document.signatures || document.signatures.length === 0) {
    return false;
  }
  
  const userEmail = userStore?.currentUser?.email;
  
  const userSignature = document.signatures.find(s => s.signer_email === userEmail);
  
  if (!userSignature) {
    return false;
  }
  
  if (userSignature.signed) {
    return false;
  }
  
  return true;
}

/**
 * Card configurations - same as BaseDocumentCard
 */
const cardConfigs = {
  lawyer: {
    getMenuOptions: (document, context, userStore) => {
      const baseOptions = [
        { label: "Editar", action: "edit" },
        { label: "Permisos", action: "permissions" },
        { label: "Administrar Asociaciones", action: "relationships" },
        { label: "Eliminar", action: "delete" },
        { label: "Previsualización", action: "preview" },
        { label: "Crear una Copia", action: "copy" },
        { label: "Gestionar Membrete", action: "letterhead" },
      ];
      
      // Add state-based options
      if (document.state === "Draft") {
        baseOptions.push({
          label: "Publicar",
          action: "publish",
          disabled: !canPublishDocument(document),
        });
      } else if (document.state === "Published") {
        baseOptions.push({
          label: "Mover a Borrador",
          action: "draft",
        });
        
        baseOptions.push({
          label: "Formalizar y Agregar Firmas",
          action: "formalize",
        });
      }

      // Add common actions for completed documents
      if (document.state === 'Completed' || document.state === 'Published') {
        baseOptions.push(
          { label: "Descargar PDF", action: "downloadPDF" },
          { label: "Descargar Word", action: "downloadWord" },
          { label: "Enviar por Email", action: "email" }
        );
      }

      // Add signature-related options
      if (document.requires_signature) {
        baseOptions.push({
          label: "Ver Firmas",
          action: "viewSignatures"
        });

        // Add sign option if the lawyer needs to sign
        if (canSignDocument(document, userStore)) {
          baseOptions.push({
            label: "Firmar documento",
            action: "sign"
          });
        }
      }

      return baseOptions;
    }
  },

  signatures: {
    getMenuOptions: (document, context, userStore) => {
      const options = [
        { label: "Previsualizar", action: "preview" },
        { label: "Gestionar Membrete", action: "letterhead" }
      ];

      // Add signature-related options
      if (document.requires_signature && (document.state === 'PendingSignatures' || document.state === 'FullySigned')) {
        options.push({
          label: "Estado de las firmas",
          action: "viewSignatures"
        });
      }

      // Sign document option
      if (canSignDocument(document, userStore)) {
        options.push({
          label: "Firmar documento",
          action: "sign"
        });
      }

      // Download signed document option (only for fully signed documents)
      if (document.state === 'FullySigned') {
        options.push({
          label: "Descargar Documento firmado",
          action: "downloadSignedDocument"
        });
      }

      // Download PDF option
      if (document.state === 'PendingSignatures') {
        options.push({
          label: "Descargar PDF",
          action: "downloadPDF"
        });
      }

      return options;
    }
  },

  client: {
    getMenuOptions: (document, context, userStore) => {
      const options = [];
      const isBasicUser = userStore?.currentUser?.role === 'basic';
      
      // Edit options with submenu for completed documents
      if (document.state === "Completed") {
        options.push({
          label: "Editar",
          action: "edit-submenu",
          isGroup: true,
          children: [
            {
              label: "Editar Formulario",
              action: "editForm"
            },
            {
              label: "Editar Documento", 
              action: "editDocument"
            }
          ]
        });
      } else {
        // For non-completed documents, keep simple "Completar" option
        options.push({
          label: "Completar",
          action: "editForm"
        });
      }

      // Preview option for completed documents
      if (document.state === 'Completed') {
        options.push({
          label: "Previsualizar",
          action: "preview"
        });
      }

      // Delete option
      options.push({
        label: "Eliminar",
        action: "delete"
      });

      // Add letterhead management option (restricted for basic users)
      if (!isBasicUser) {
        options.push({ label: "Gestionar Membrete", action: "letterhead" });
      } else {
        // Show disabled option for basic users
        options.push({ 
          label: "Gestionar Membrete", 
          action: "letterhead",
          disabled: true
        });
      }

      // Add document relationships management option
      options.push({ label: "Administrar Asociaciones", action: "relationships" });

      // Options only for Completed state
      if (document.state === 'Completed') {
        options.push(
          {
            label: "Descargar PDF",
            action: "downloadPDF"
          },
          {
            label: "Descargar Word",
            action: "downloadWord"
          },
          {
            label: "Enviar",
            action: "email"
          }
        );
      }

      return options;
    }
  }
};

/**
 * Get menu options for a document based on card type
 * @param {string} cardType - 'lawyer', 'signatures', or 'client'
 * @param {Object} document - Document object
 * @param {string} context - Context (e.g., 'list', 'folder')
 * @param {Object} userStore - User store instance
 * @returns {Array} Array of menu options
 */
export function getMenuOptionsForCardType(cardType, document, context = 'list', userStore = null) {
  const config = cardConfigs[cardType];
  if (!config) {
    return [];
  }
  
  return config.getMenuOptions(document, context, userStore);
}

export { canPublishDocument, canSignDocument };

