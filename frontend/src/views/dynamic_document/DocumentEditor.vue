<template>
  <main class="flex h-screen w-full">
    <Editor
      api-key="tmizyezb3c6j68qwkp8d5hrr3vgk5va6uouidoe2hj7nxp3p"
      v-model="editorContent"
      :init="editorConfig"
    />
  </main>
</template>

<script setup>
import Editor from "@tinymce/tinymce-vue";
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { showNotification } from "@/shared/notification_message";

const editorContent = ref(""); // Content of the editor
const router = useRouter();
const route = useRoute();
const store = useDynamicDocumentStore();
const userStore = useUserStore();

// Detect if user is a client (vs lawyer)
const isClient = computed(() => {
  return route.path.includes('/client/editor/') || userStore.currentUser?.role !== 'lawyer';
});

// Store the original content with variables
const originalContent = ref("");
const processedContent = ref("");

onMounted(async () => {
  const documentId = route.params.id;
  if (documentId) {
    try {
      // Get updated document using store method
      const documentData = await store.fetchDocumentById(documentId, true); // true to force refresh
      
      // Update document in store
      store.selectedDocument = documentData;
      originalContent.value = documentData?.content || "";
      
      // For clients, replace variables with values and protect them
      if (isClient.value) {
        editorContent.value = replaceVariablesWithValues(originalContent.value);
      } else {
        // For lawyers, use original content with {{variables}}
        editorContent.value = originalContent.value;
      }
    } catch (error) {
      console.error("Error fetching document:", error);
      // If request fails, use store document as fallback
      store.selectedDocument = await store.documentById(documentId);
      originalContent.value = store.selectedDocument?.content || "";
      
      if (isClient.value) {
        editorContent.value = replaceVariablesWithValues(originalContent.value);
      } else {
        editorContent.value = originalContent.value;
      }
    }
  }
});

/**
 * Extracts variables from the editor content using regex.
 */
const extractVariables = (content = null) => {
  const textToAnalyze = content || editorContent.value;
  const regex = /{{(.*?)}}/g;
  return Array.from(
    new Set([...textToAnalyze.matchAll(regex)].map((match) => match[1]))
  );
};

/**
 * Replaces variables in content with their actual values for client view
 */
const replaceVariablesWithValues = (content) => {
  if (!content || !store.selectedDocument?.variables) return content;
  
  let processedContent = content;
  
  store.selectedDocument.variables.forEach(variable => {
    const variablePattern = new RegExp(`{{${variable.name_en}}}`, 'g');
    const value = variable.value || `[${variable.name_es || variable.name_en}]`;
    
    // Create a highly protected span with multiple protection layers
    const protectedSpan = `<span 
      class="variable-protected mceNonEditable" 
      data-variable="${variable.name_en}" 
      data-mce-contenteditable="false"
      contenteditable="false" 
      unselectable="on"
      style="background-color: #ffeb3b !important; color: #d32f2f !important; padding: 2px 4px !important; border-radius: 3px !important; font-weight: bold !important; cursor: not-allowed !important; user-select: none !important; -webkit-user-select: none !important; -moz-user-select: none !important; -ms-user-select: none !important; display: inline-block !important;"
      title="Variable protegida: ${variable.name_es || variable.name_en} - No se puede editar"
      onmousedown="return false;"
      onselectstart="return false;"
      ondragstart="return false;"
    >${value}</span>`;
    
    processedContent = processedContent.replace(variablePattern, protectedSpan);
  });
  
  return processedContent;
};

/**
 * Converts protected spans back to variable format for saving
 */
const convertProtectedSpansToVariables = (content) => {
  if (!content) return content;
  
  // Replace protected spans back to {{variable}} format - handle both single and multi-line spans
  return content.replace(
    /<span[^>]*(?:class="[^"]*variable-protected[^"]*"|data-variable="([^"]*)")(?:[^>]*data-variable="([^"]*)")?[^>]*>[\s\S]*?<\/span>/g, 
    (match, var1, var2) => {
      const variableName = var1 || var2;
      return variableName ? `{{${variableName}}}` : match;
    }
  );
};

/**
 * Synchronizes extracted variables with the document's existing variables.
 * Maintains name_es and field_type if they already exist for a variable.
 * @param {Array<string>} variables - Extracted variable names.
 */
const syncVariables = (variables) => {
  const existingVariables = store.selectedDocument?.variables || [];
  const updatedVariables = variables.map((name) => {
    const existingVariable = existingVariables.find((v) => v.name_en === name);
    return {
      name_en: name,
      name_es: existingVariable?.name_es || "",
      tooltip: existingVariable?.tooltip || "",
      field_type: existingVariable?.field_type || "input",
      value: existingVariable?.value || "",
      select_options: existingVariable?.field_type === 'select' ? (existingVariable?.select_options || []) : null
    };
  });
  store.selectedDocument.variables = updatedVariables;
};

/**
 * Save the document content (for clients) - preserves original state
 */
const saveDocumentContent = async () => {
  try {
    const contentToSave = convertProtectedSpansToVariables(editorContent.value);
    
    if (store.selectedDocument) {
      // Preserve original state and other properties, only update content
      const updatedDocument = {
        ...store.selectedDocument,
        content: contentToSave
        // Deliberately NOT changing state - preserve original
      };
      
      const response = await store.updateDocument(store.selectedDocument.id, updatedDocument);
      
      if (response) {
        await showNotification("Documento guardado exitosamente.", "success");
        
        // Redirect to documents dashboard after successful save
        setTimeout(() => {
          window.location.href = '/dynamic_document_dashboard';
        }, 500);
      }
    } else {
      await showNotification("Error: No se encontró el documento para guardar.", "error");
    }
  } catch (error) {
    console.error("Error saving document content:", error);
    await showNotification("Error al guardar el documento.", "error");
  }
};

/**
 * Save the document as a draft (for lawyers).
 */
const saveDocumentDraft = async () => {
  try {
    const contentToSave = editorContent.value;
    
    // Check if document content is empty
    if (isContentEmpty(contentToSave)) {
      await showNotification(
        "No puedes guardar un documento vacío. Por favor, agrega contenido al documento antes de guardarlo.", 
        "warning"
      );
      return;
    }
    
    // Extract variables from editor content
    const variables = extractVariables();
    
    if (store.selectedDocument) {
      store.selectedDocument.content = contentToSave;
      store.selectedDocument.state = "Draft";
      
      // Sync variables if there are any
      if (variables.length > 0) {
        syncVariables(variables);
      }
    } else {
      store.selectedDocument = {
        title:
          store.selectedDocument?.title ||
          route.params.title ||
          "Untitled Document",
        content: contentToSave,
        state: "Draft",
        variables: [],
      };
      
      // Sync variables if there are any
      if (variables.length > 0) {
        syncVariables(variables);
      }
    }
    
    let documentId;
    let response;
    
    if (store.selectedDocument?.id) {
      documentId = store.selectedDocument.id;
      response = await store.updateDocument(
        documentId,
        store.selectedDocument
      );
    } else {
      response = await store.createDocument(store.selectedDocument);
      if (response && response.id) {
        documentId = response.id;
      }
    }
    
    // Save the current store
    const currentSelectedDoc = store.selectedDocument;
    
    // Refresh documents to get the updated list
    store.selectedDocument = null;
    await store.init();
    
    // If we couldn't get an ID from the response, try to find the document by title
    if (!documentId && currentSelectedDoc && currentSelectedDoc.title) {
      const foundDoc = store.documents.find(doc => 
        doc.title === currentSelectedDoc.title &&
        doc.content === currentSelectedDoc.content &&
        doc.state === 'Draft'
      );
      
      if (foundDoc) {
        documentId = foundDoc.id;
      }
    }
    
    // Ensure lastUpdatedDocumentId is updated with explicit assignment
    if (documentId) {
      // Set the ID in localStorage for persistence across redirects
      localStorage.setItem('lastUpdatedDocumentId', documentId.toString());
      store.lastUpdatedDocumentId = documentId;
    }
    
    await showNotification("¡Borrador guardado exitosamente!", "success");
    
    // Use a longer delay before redirect to ensure store state is properly saved
    setTimeout(() => {
      window.location.href = '/dynamic_document_dashboard';
    }, 500);
  } catch (error) {
    console.error("Error saving draft:", error);
    await showNotification("Error al guardar el borrador.", "error");
  }
};

/**
 * Check if document content is empty or contains only whitespace/HTML tags
 */
const isContentEmpty = (content) => {
  if (!content || content.trim() === '') return true;
  
  // Remove HTML tags and check if there's actual text content
  const textContent = content.replace(/<[^>]*>/g, '').trim();
  return textContent === '' || textContent === '&nbsp;';
};

/**
 * Handle the continue action by synchronizing variables and navigating to the next step.
 */
const handleContinue = async () => {
  // Check if document content is empty
  if (isContentEmpty(editorContent.value)) {
    await showNotification(
      "No puedes continuar con un documento vacío. Por favor, agrega contenido al documento antes de continuar.", 
      "warning"
    );
    return;
  }

  const variables = extractVariables();
  if (variables.length > 0) {
    if (store.selectedDocument) {
      store.selectedDocument.content = editorContent.value;
    } else {
      store.selectedDocument = {
        title: route.params.title || "Untitled Document",
        content: editorContent.value,
        variables: [],
      };
    }
    syncVariables(variables);
    router.push("/dynamic_document_dashboard/lawyer/variables-config");
  } else {
    // If there are no variables, save as draft and update lastUpdatedDocumentId
    await saveDocumentDraft();
  }
};

// Global reference for the editor (ensure it is available throughout the scope)
let tinyMCEEditor = null;
let isProcessingContent = false;

/**
 * Ensures that the Carlito font is applied to the given content without removing other styles.
 * 
 * @param {string} content - The HTML content to process.
 * @returns {string} - The modified content with Carlito font enforced.
 */
function enforceCarlito(content) {
  if (!content || typeof content !== 'string') return content;
  
  try {
    return content.replace(
      /(font-family\s*:\s*)([^;!]*)([;!])/gi,
      "font-family: 'Carlito', sans-serif$3"
    ).replace(
      /<([a-z][a-z0-9]*)\b([^>]*)(?!\bstyle=)([^>]*)>/gi,
      function(match, tag, attrs, closeTag) {
        if (!/style=/i.test(attrs)) {
          return `<${tag}${attrs} style="font-family: 'Carlito', sans-serif;"${closeTag}>`;
        }
        return match;
      }
    );
  } catch (error) {
    console.error("[ERROR] Failed to apply Carlito font:", error);
    return content;
  }
}

/**
 * Configuration object for the TinyMCE editor.
 */
const editorConfig = computed(() => ({
  language: "es",
  plugins: isClient.value 
    ? "lists link image table code wordcount autolink searchreplace textpattern noneditable"
    : "lists link image table code wordcount autolink searchreplace textpattern", 
  menubar: "",
  toolbar: isClient.value 
    ? "save return | undo redo | formatselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | outdent indent | blocks fontsize lineheight | forecolor | removeformat | hr"
    : "save continue return | undo redo | formatselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | outdent indent | blocks fontsize lineheight | forecolor | removeformat | hr",
  height: "100vh",
  width: "100%",

  content_style: `
    @import url('https://fonts.googleapis.com/css2?family=Carlito&display=swap');
    body, p, span, div, strong, em, u, i, b {
      font-family: 'Carlito', sans-serif !important;
    }
    .variable-protected {
      background-color: #ffeb3b !important;
      color: #d32f2f !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      font-weight: bold !important;
      cursor: not-allowed !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
    }
  `,

  font_formats: "Carlito=Carlito, sans-serif;",
  
  paste_webkit_styles: "all",
  paste_remove_styles_if_webkit: false,
  paste_merge_formats: true,
  paste_as_text: false,
  
  keep_styles: true,
  
  forced_root_block: 'p',
  forced_root_block_attrs: { 
    style: "font-family: 'Carlito', sans-serif;" 
  },

  // Configuration for noneditable plugin (only for clients)
  ...(isClient.value && {
    noneditable_noneditable_class: 'variable-protected',
    noneditable_editable_class: 'mce-editable',
    content_css_cors: true,
  }),

  /**
   * Sets up the TinyMCE editor with custom configurations and event listeners.
   * 
   * @param {object} editor - The TinyMCE editor instance.
   */
  setup: (editor) => {    
    tinyMCEEditor = editor;

    editor.ui.registry.addButton("save", {
      text: isClient.value ? "Guardar" : "Guardar como borrador",
      icon: "save",
      onAction: () => {
        if (isClient.value) {
          saveDocumentContent();
        } else {
          saveDocumentDraft();
        }
      },
    });

    editor.ui.registry.addButton("continue", {
      text: "Continuar",
      icon: "chevron-right",
      onAction: () => {
        handleContinue();
      },
    });

    editor.ui.registry.addButton("return", {
      text: "Regresar",
      icon: "chevron-left",
      onAction: () => {
        handleBack();
      },
    });

    editor.on("init", () => {      
      try {        
        setTimeout(() => {
          try {
            const currentContent = editor.getContent();
            const updatedContent = enforceCarlito(currentContent);
            if (currentContent !== updatedContent) {
              isProcessingContent = true;
              editor.setContent(updatedContent);
              isProcessingContent = false;
            }
          } catch (error) {
            console.error("[ERROR] Failed to initialize content:", error);
          }
        }, 100);
      } catch (error) {
        console.error("[ERROR] Initialization failed:", error);
      }
    });

    editor.on("BeforeSetContent", (e) => {
      if (e.content) {
        e.content = e.content.replace(
          /<([a-z][a-z0-9]*)\b([^>]*)(style=["'])([^"']*)["']([^>]*)>/gi,
          function(match, tag, beforeStyle, styleAttr, styleValue, afterStyle) {
            if (!styleValue.includes('font-family')) {
              return `<${tag}${beforeStyle}${styleAttr}font-family: 'Carlito', sans-serif; ${styleValue}"${afterStyle}>`;
            }
            return match.replace(
              /(font-family\s*:\s*)([^;"]*)([;"])/gi,
              "font-family: 'Carlito', sans-serif$3"
            );
          }
        );
      }
    });

    editor.on("SetContent", (e) => {
      if (isProcessingContent) return;
      
      try {
        if (e.source_view || e.paste || e.setup) {
          isProcessingContent = true;
          
          setTimeout(() => {
            try {
              const currentContent = editor.getContent();
              const updatedContent = enforceCarlito(currentContent);
              
              if (currentContent !== updatedContent) {
                editor.setContent(updatedContent, { format: "raw", no_events: true });
              }
            } catch (innerError) {
              console.error("[ERROR] Failed to process SetContent:", innerError);
            } finally {
              isProcessingContent = false;
            }
          }, 50);
        }
      } catch (error) {
        console.error("[ERROR] SetContent event error:", error);
        isProcessingContent = false;
      }
    });

    let lastInputTime = 0;
    editor.on("input", () => {
      const now = Date.now();
      if (now - lastInputTime > 1000) {
        lastInputTime = now;
      }
    });

    // Add protection for variables for client users
    if (isClient.value) {
      // Comprehensive protection for variables
      const protectVariables = () => {
        const protectedElements = editor.dom.select('.variable-protected');
        protectedElements.forEach(element => {
          // Apply all possible protection attributes
          element.setAttribute('contenteditable', 'false');
          element.setAttribute('data-mce-contenteditable', 'false');
          element.setAttribute('unselectable', 'on');
          element.className = element.className.replace('mceNonEditable', '') + ' mceNonEditable';
          
          // Style-based protection
          element.style.userSelect = 'none';
          element.style.webkitUserSelect = 'none';
          element.style.mozUserSelect = 'none';
          element.style.msUserSelect = 'none';
          element.style.pointerEvents = 'none';
          element.style.cursor = 'not-allowed';
          
          // Event-based protection
          element.onmousedown = () => false;
          element.onselectstart = () => false;
          element.ondragstart = () => false;
          element.oncontextmenu = () => false;
          
          // Make it visually distinct
          element.style.backgroundColor = '#ffeb3b';
          element.style.color = '#d32f2f';
          element.style.fontWeight = 'bold';
          element.style.padding = '2px 4px';
          element.style.borderRadius = '3px';
          element.style.display = 'inline-block';
          element.style.border = '1px solid #fbc02d';
          
          // Add tooltip
          element.title = 'Variable protegida - No se puede editar';
        });
      };

      // Prevent all forms of variable deletion/modification
      editor.on("keydown", (e) => {
        const selection = editor.selection;
        const selectedNode = selection.getNode();
        const range = selection.getRng();
        
        // Check if cursor is near or inside a protected variable
        const isNearProtected = selectedNode.classList?.contains('variable-protected') || 
                               selectedNode.closest('.variable-protected') ||
                               range.commonAncestorContainer?.parentElement?.classList?.contains('variable-protected');
        
        // Check if selection contains any protected variables
        const selectedContent = selection.getContent();
        const containsProtected = selectedContent.includes('variable-protected') || 
                                 selectedContent.includes('data-variable=');
        
        // Prevent any destructive actions on protected content
        if ((e.key === 'Backspace' || e.key === 'Delete' || e.key === 'x' && (e.ctrlKey || e.metaKey)) && 
            (isNearProtected || containsProtected)) {
          e.preventDefault();
          e.stopPropagation();
          
          // Move cursor away from protected element
          if (isNearProtected) {
            const protectedElement = selectedNode.classList?.contains('variable-protected') ? 
                                   selectedNode : selectedNode.closest('.variable-protected');
            if (protectedElement) {
              const nextNode = protectedElement.nextSibling;
              if (nextNode) {
                selection.select(nextNode);
                selection.collapse(true);
              } else {
                // Create a space after the protected element if none exists
                const space = editor.dom.create('span', {}, '\u00A0');
                editor.dom.insertAfter(space, protectedElement);
                selection.select(space);
                selection.collapse(true);
              }
            }
          }
          
          return false;
        }

        // Prevent typing inside protected variables
        if (isNearProtected && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          return false;
        }
      });

      // Prevent pasting over or into protected variables
      editor.on("paste", (e) => {
        const selection = editor.selection;
        const selectedNode = selection.getNode();
        const selectedContent = selection.getContent();
        
        if (selectedNode.classList?.contains('variable-protected') || 
            selectedNode.closest('.variable-protected') ||
            selectedContent.includes('variable-protected')) {
          e.preventDefault();
          return false;
        }
      });

      // Monitor and restore content if variables are compromised
      let lastValidContent = '';
      
      editor.on("BeforeSetContent", (e) => {
        if (!isProcessingContent && e.content) {
          lastValidContent = editor.getContent();
        }
      });

      editor.on("SetContent", (e) => {
        if (!isProcessingContent) {
          setTimeout(() => {
            protectVariables();
          }, 10);
        }
      });

      // Continuous monitoring and protection
      editor.on("input", () => {
        if (isProcessingContent) return;
        
        const currentContent = editor.getContent();
        
        // Check if any variables were removed
        const originalVariableCount = (originalContent.value.match(/{{.*?}}/g) || []).length;
        const currentVariableSpans = (currentContent.match(/variable-protected/g) || []).length;
        
        if (currentVariableSpans < originalVariableCount) {
          // Variables were compromised, restore and re-protect
          isProcessingContent = true;
          const restoredContent = replaceVariablesWithValues(originalContent.value);
          editor.setContent(restoredContent);
          setTimeout(() => {
            protectVariables();
            isProcessingContent = false;
          }, 10);
          return;
        }

        // Re-apply protection to any variables that lost it
        protectVariables();
      });

      // Prevent drag and drop that might affect variables
      editor.on("dragstart", (e) => {
        const target = e.target;
        if (target.classList?.contains('variable-protected') || 
            target.closest('.variable-protected')) {
          e.preventDefault();
          return false;
        }
      });

      // Block any selection that includes protected variables
      editor.on("selectionchange", () => {
        const selectedContent = editor.selection.getContent();
        if (selectedContent.includes('variable-protected') || 
            selectedContent.includes('mceNonEditable')) {
          // If selection includes protected content, clear it
          const selection = editor.selection;
          const range = selection.getRng();
          
          // Find a safe place to put the cursor
          const body = editor.getBody();
          const textNodes = editor.dom.select('p,div', body);
          
          if (textNodes.length > 0) {
            const safeNode = textNodes[0];
            selection.select(safeNode);
            selection.collapse(true);
          }
        }
      });

      // Additional event to prevent any changes to protected elements
      editor.on("beforeinput", (e) => {
        const selection = editor.selection;
        const selectedNode = selection.getNode();
        
        if (selectedNode.classList?.contains('variable-protected') || 
            selectedNode.closest('.variable-protected') ||
            selection.getContent().includes('variable-protected')) {
          e.preventDefault();
          return false;
        }
      });

      // Apply initial protection after editor initialization
      editor.on("init", () => {
        setTimeout(() => {
          protectVariables();
        }, 100);
      });

      // Re-apply protection when content is loaded
      editor.on("LoadContent", () => {
        setTimeout(() => {
          protectVariables();
        }, 50);
      });
    }
  },
}));

/**
 * Handles navigation back to the document dashboard.
 */
const handleBack = () => {
  router.push("/dynamic_document_dashboard");
};
</script>
