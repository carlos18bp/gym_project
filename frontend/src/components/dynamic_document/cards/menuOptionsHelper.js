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
      let baseOptions;

      // For Minutas (archivos jurídicos) in lawyer view, provide a submenu
      // with three distinct edit actions: update name, document editor, and variables configuration.
      if (context === 'legal-documents' && (document.state === 'Draft' || document.state === 'Published')) {
        baseOptions = [
          {
            label: "Editar",
            action: "edit-submenu",
            isGroup: true,
            children: [
              {
                label: "Actualizar nombre",
                action: "edit"
              },
              {
                label: "Editar documento",
                action: "editDocument"
              },
              {
                label: "Editar configuración de variables",
                action: "editForm"
              }
            ]
          },
          { label: "Permisos", action: "permissions" },
          { label: "Eliminar", action: "delete" },
          { label: "Previsualización", action: "preview" },
          { label: "Crear una Copia", action: "copy" },
          { label: "Gestionar Membrete", action: "letterhead" },
        ];
      } else {
        // Default behavior for other contexts/states
        baseOptions = [
          { label: "Editar", action: "edit" },
          { label: "Permisos", action: "permissions" },
          { label: "Eliminar", action: "delete" },
          { label: "Previsualización", action: "preview" },
          { label: "Crear una Copia", action: "copy" },
          { label: "Gestionar Membrete", action: "letterhead" },
        ];
      }
      
      // Only add "Administrar Asociaciones" for documents that are NOT Draft or Published
      // Minutas (Draft/Published) should not have relationship management
      if (document.state !== 'Draft' && document.state !== 'Published') {
        baseOptions.splice(2, 0, { label: "Administrar Asociaciones", action: "relationships" });
      }
      
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
      // Only show for documents in signature workflow (PendingSignatures or FullySigned)
      if (document.requires_signature && (document.state === 'PendingSignatures' || document.state === 'FullySigned')) {
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
      // For signatures context (documentos por firmar/firmados/archivados)
      const options = [
        { label: "Previsualizar", action: "preview" },
        { label: "Gestionar Membrete", action: "letterhead" }
      ];

      // Document relationships management (read-only in signatures context)
      // Enabled only when the document already has associations
      const hasRelationships = document.relationships_count && document.relationships_count > 0;
      options.push({
        label: "Administrar Asociaciones",
        action: "relationships",
        disabled: !hasRelationships
      });

      // Add signature-related options
      if (document.requires_signature) {
        const signatureStates = ['PendingSignatures', 'FullySigned', 'Rejected', 'Expired'];
        if (signatureStates.includes(document.state)) {
          options.push({
            label: "Estado de las firmas",
            action: "viewSignatures"
          });
        }
      }

      // Sign document option
      if (canSignDocument(document, userStore)) {
        options.push({
          label: "Firmar documento",
          action: "sign"
        });
      }

      // Reject document option (only when user can sign and document is pending signatures)
      if (document.state === 'PendingSignatures' && canSignDocument(document, userStore)) {
        options.push({
          label: "Rechazar documento",
          action: "reject"
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

      // View rejection reason option for rejected documents
      if (document.state === 'Rejected') {
        const hasComment = Array.isArray(document.signatures) && document.signatures.some(sig => sig.rejection_comment);
        if (hasComment) {
          options.push({
            label: "Ver motivo del rechazo",
            action: "viewRejectionReason"
          });
        }
      }

      return options;
    }
  },

  client: {
    getMenuOptions: (document, context, userStore) => {
      const options = [];
      const isBasicUser = userStore?.currentUser?.role === 'basic';
      const isCorporateOrClient = userStore?.currentUser?.role === 'corporate_client' || 
                                   userStore?.currentUser?.role === 'client';
      const isLawyer = userStore?.currentUser?.role === 'lawyer';
      const isProgress = document.state === 'Progress';
      
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
            }
          ]
        });
        
        // Add "Formalizar y Agregar Firmas" for Corporate/Client/Lawyer roles and show disabled for Basic
        if (isCorporateOrClient || isBasicUser || isLawyer) {
          options.push({
            label: "Formalizar y Agregar Firmas",
            action: "formalize",
            disabled: isBasicUser
          });
        }
      } else if (document.state === 'Progress') {
        // For in-progress documents, allow only completing the form
        options.push({
          label: "Completar",
          action: "editForm"
        });

        if (isCorporateOrClient || isBasicUser || isLawyer) {
          options.push({
            label: "Formalizar y Agregar Firmas",
            action: "formalize",
            // Siempre deshabilitado en estado Progress; el tooltip en el modal explicará el motivo
            disabled: true
          });
        }
      } else {
        // For other non-completed documents (e.g. Draft), keep simple "Completar" option
        options.push({
          label: "Completar",
          action: "editForm"
        });
      }

      // Preview option for completed and in-progress documents
      if (document.state === 'Completed' || document.state === 'Progress') {
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

      // Add document relationships management option (restricted for basic users)
      options.push({ 
        label: "Administrar Asociaciones", 
        action: "relationships",
        // Disabled for basic users and when document is still in Progress
        disabled: isBasicUser || isProgress
      });

      // Add signature-related options for documents that require signatures
      if (document.requires_signature) {
        const signatureStates = ['PendingSignatures', 'FullySigned', 'Rejected', 'Expired'];
        const isSignatureState = signatureStates.includes(document.state);
        // Do not show signature options in the 'my-documents' context; those flujos se manejan
        // en las vistas específicas de firmas (Documentos por firmar, Firmados, Archivados).
        if (context !== 'my-documents' && isSignatureState) {
          options.push({
            label: "Ver Firmas",
            action: "viewSignatures"
          });

          // Add sign option if the user needs to sign
          if (canSignDocument(document, userStore)) {
            options.push({
              label: "Firmar documento",
              action: "sign"
            });
          }
        }
      }

      // Download / share options for Completed and Progress.
      // En estado Progress mostramos las mismas acciones pero deshabilitadas,
      // con tooltips en el modal explicando que sólo aplican a documentos completados.
      if (document.state === 'Completed' || document.state === 'Progress') {
        const isCompleted = document.state === 'Completed';
        options.push(
          {
            label: "Descargar PDF",
            action: "downloadPDF",
            disabled: !isCompleted
          },
          {
            label: "Descargar Word",
            action: "downloadWord",
            disabled: isBasicUser || !isCompleted
          },
          {
            label: "Enviar",
            action: "email",
            disabled: isBasicUser || !isCompleted
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

