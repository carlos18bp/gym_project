<template>
  <main id="dynamic-editor">
    <Editor
      api-key="4t8cc9bwljf28ozot9bcdmkmy73qpmqjku6qvl6foci88y6l"
      v-model="editorContent"
      :init="{
        toolbar_mode: 'scrolling',
        plugins: ['searchreplace'],
        toolbar: 'undo redo | bold italic underline | removeformat',
        menubar: 'edit format', // Solo habilitar Edit y Format
        menu: {
          format: { // Personalizar el menú Format
            title: 'Format', // Título del menú
            items: 'blocks fontfamily fontsize align lineheight | bold italic underline strikethrough | removeformat'
          },
          edit: { // Mantener Edit sin cambios
            title: 'Edit',
            items: 'undo redo | cut copy paste | selectall searchreplace'
          }
        },
        block_formats: 'Paragraph=p; Header 1=h1; Header 2=h2; Header 3=h3; Header 4=h4; Blockquote=blockquote', // Configurar opciones de blocks
        fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt', // Configurar tamaños de fuente
        font_family_formats: 'Arial=arial,helvetica,sans-serif; Courier New=courier new,courier,monospace; Georgia=georgia,palatino,serif; Times New Roman=times new roman,times,serif; Verdana=verdana,geneva,sans-serif' // Configurar fuentes
      }"
    />

    <button @click="extractVariables">Generate Form</button>

    <div v-if="variables.length > 0">
      <h4>Dynamic Form</h4>
      <form @submit.prevent="submitForm">
        <!-- Document title field -->
        <div>
          <label for="document-title">Document Title</label>
          <input type="text" v-model="formData.title" id="document-title" placeholder="Enter document title" />
        </div>

        <!-- Form fields for variables -->
        <div v-for="(variable, index) in variables" :key="index">
          <label :for="variable">{{ variable }}</label>
          <input type="text" v-model="formData[variable]" :id="variable" />
        </div>

        <button type="submit">Save Document</button>
      </form>
    </div>
  </main>
</template>

<script setup>
import { ref, watch } from "vue";
import Editor from "@tinymce/tinymce-vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument"; // Access the store

const editorContent = ref(""); // Content of the TinyMCE editor
const variables = ref([]); // List of dynamic variables
const formData = ref({ title: "" }); // Form data including title and variable values
const store = useDynamicDocumentStore(); // Access the dynamic document store

// Extract variables from the editor content
const extractVariables = () => {
  const regex = /{{(.*?)}}/g;

  // Detect new variables
  const newVariables = Array.from(new Set([...editorContent.value.matchAll(regex)].map((match) => match[1])));

  // Combine existing values with new variables
  const existingValues = { ...formData.value };
  const newFormData = { title: existingValues.title || "", ...existingValues };

  newVariables.forEach((variable) => {
    if (!newFormData[variable]) {
      newFormData[variable] = ""; // Initialize new variable with an empty value
    }
  });

  // Update variables and formData
  variables.value = newVariables;
  formData.value = newFormData;
};

// Submit the form to save or update the document
const submitForm = () => {
  const documentData = {
    title: formData.value.title,
    content: editorContent.value,
    variables: variables.value,
    values: Object.fromEntries(variables.value.map((key) => [key, formData.value[key]])),
  };

  if (store.selectedDocument) {
    // Update the document if selectedDocument exists
    store.updateDocument(store.selectedDocument.id, documentData);
  } else {
    // Create a new document if no document is selected
    store.createDocument(documentData);
  }

  alert("Document saved!");
};

// Load a selected document into the editor and form
const loadDocument = (doc) => {
  editorContent.value = doc.content; // Load document content
  variables.value = doc.variables; // Load document variables
  formData.value = { title: doc.title, ...doc.values }; // Load title and variable values
};

// Watch for changes in the selected document
watch(() => store.selectedDocument, (doc) => {
  if (doc) loadDocument(doc);
});
</script>

<style scoped>
button {
  margin: 10px 5px;
  padding: 5px 10px;
  cursor: pointer;
}

button:hover {
  background-color: #f0f0f0;
}
</style>
