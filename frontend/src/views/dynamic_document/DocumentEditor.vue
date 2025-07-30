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
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { showNotification } from "@/shared/notification_message";

const editorContent = ref(""); // Content of the editor
const router = useRouter();
const route = useRoute();
const store = useDynamicDocumentStore();

onMounted(async () => {
  const documentId = route.params.id;
  if (documentId) {
    try {
      // Get updated document using store method
      const documentData = await store.fetchDocumentById(documentId, true); // true to force refresh
      
      // Update document in store
      store.selectedDocument = documentData;
      editorContent.value = documentData?.content || "";
    } catch (error) {
      console.error("Error fetching document:", error);
      // If request fails, use store document as fallback
      store.selectedDocument = await store.documentById(documentId);
      editorContent.value = store.selectedDocument?.content || "";
    }
  }
});

/**
 * Extracts variables from the editor content using regex.
 */
const extractVariables = () => {
  const regex = /{{(.*?)}}/g;
  return Array.from(
    new Set([...editorContent.value.matchAll(regex)].map((match) => match[1]))
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
 * Save the document as a draft.
 */
const saveDocumentDraft = async () => {
  try {
    // Extract variables from editor content
    const variables = extractVariables();
    
    if (store.selectedDocument) {
      store.selectedDocument.content = editorContent.value;
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
        content: editorContent.value,
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
 * Handle the continue action by synchronizing variables and navigating to the next step.
 */
const handleContinue = async () => {
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
const editorConfig = {
  language: "es",
  plugins: "lists link image table code wordcount autolink searchreplace textpattern", 
  menubar: "",
  toolbar:
    "save continue return | undo redo | formatselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | outdent indent | blocks fontsize lineheight | forecolor | removeformat | hr",
  height: "100vh",
  width: "100%",

  content_style: `
    @import url('https://fonts.googleapis.com/css2?family=Carlito&display=swap');
    body, p, span, div, strong, em, u, i, b {
      font-family: 'Carlito', sans-serif !important;
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

  /**
   * Sets up the TinyMCE editor with custom configurations and event listeners.
   * 
   * @param {object} editor - The TinyMCE editor instance.
   */
  setup: (editor) => {    
    tinyMCEEditor = editor;

    editor.ui.registry.addButton("save", {
      text: "Guardar como borrador",
      icon: "save",
      onAction: () => {
        saveDocumentDraft();
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
  },
};

/**
 * Handles navigation back to the document dashboard.
 */
const handleBack = () => {
  router.push("/dynamic_document_dashboard");
};
</script>
