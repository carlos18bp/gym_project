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
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { showNotification } from "@/shared/notification_message";

const editorContent = ref(""); // Content of the editor
const router = useRouter();
const route = useRoute();
const store = useDynamicDocumentStore();

onMounted(async () => {
  const documentId = route.params.id;
  if (documentId) {
    store.selectedDocument = await store.documentById(documentId);
    editorContent.value = store.selectedDocument?.content || "";
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
    };
  });
  store.selectedDocument.variables = updatedVariables;
};

/**
 * Save the document as a draft.
 */
const saveDocumentDraft = async () => {
  if (store.selectedDocument) {
    store.selectedDocument.content = editorContent.value;
    store.selectedDocument.state = "Draft";
  } else {
    store.selectedDocument = {
      title:
        store.selectedDocument?.title ||
        route.params.title ||
        "Untitled Document",
      content: editorContent.value,
      state: "Draft",
    };
  }
  try {
    if (store.selectedDocument?.id) {
      await store.updateDocument(
        store.selectedDocument.id,
        store.selectedDocument
      );
    } else {
      await store.createDocument(store.selectedDocument);
    }
    store.selectedDocument = null;
    await store.init();
    await showNotification("¡Borrador guardado exitosamente!", "success");
    router.push("/dynamic_document_dashboard");
  } catch (error) {
    console.error("Error saving draft:", error);
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
    saveDocumentDraft();
  }
};

/**
 * Configuration object for the TinyMCE editor.
 */
const editorConfig = {
  language: "es", // Set editor language to Spanish
  plugins: "lists",
  menubar: "",
  toolbar: "save continue return | undo redo| formatselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | outdent indent | blocks fontfamily fontsize lineheight | forecolor backcolor | removeformat | hr",
  setup: (editor) => {
    editor.ui.registry.addButton("save", {
      text: "Guardar como borrador",
      icon: "save",
      onAction: saveDocumentDraft,
    });
    editor.ui.registry.addButton("continue", {
      text: "Continuar",
      icon: "chevron-right",
      onAction: handleContinue,
    });
    editor.ui.registry.addButton("return", {
      text: "Regresar",
      icon: "chevron-left",
      onAction: handleBack,
    });
  },
  height: "100vh", // Set editor height to full viewport height
  width: "100%", // Set editor width to full container width
};

/**
 * Handles navigation back to the document dashboard.
 */
const handleBack = () => {
  router.push("/dynamic_document_dashboard");
};
</script>
