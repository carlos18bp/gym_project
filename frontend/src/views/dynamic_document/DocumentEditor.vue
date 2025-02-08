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
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";

// Reactive reference to store the editor's content
const editorContent = ref("");

// Access the Vue Router and current route
const router = useRouter(); // Used for programmatic navigation
const route = useRoute(); // Used to access route parameters

// Configuration for the TinyMCE editor
const editorConfig = {
  // Set the editor language to Spanish
  language: "es",

  // Define the menu structure with custom items
  menu: {
    file: { title: "Archivo", items: "preview save continue" }, // Custom menu options in the 'Archivo' menu
  },

  // Enable plugins for various editor features
  plugins: "lists link image table code help wordcount",

  // Define the toolbar layout with formatting options
  toolbar:
    "undo redo | formatselect | bold italic | alignleft aligncenter alignright alignjustify | outdent indent | link image code",

  // Enable the menubar with default and custom menus
  menubar: "file edit view insert format tools help",

  // Setup function to define custom menu items
  setup: (editor) => {
    // Add a custom 'Preview' menu item
    editor.ui.registry.addMenuItem("preview", {
      text: "Previsualizar", // Label for the menu item
      icon: "preview", // Icon to display
      onAction: () => alert("Previsualización en desarrollo"), // Action triggered when clicked
    });

    // Add a custom 'Save' menu item
    editor.ui.registry.addMenuItem("save", {
      text: "Guardar", // Label for the menu item
      icon: "save", // Icon to display
      onAction: () => alert("Guardado en desarrollo"), // Action triggered when clicked
    });

    // Add a custom 'Continue' menu item
    editor.ui.registry.addMenuItem("continue", {
      text: "Continuar", // Label for the menu item
      icon: "chevron-right", // Icon to display
      onAction: () => {
        // Get the 'name' parameter from the current route
        const documentName = route.params.name;

        // Redirect to a nested route using the document name
        router.push(
          `/dynamic_document_dashboard/document/new/${documentName}/variables-config`
        );
      },
    });
  },

  // Set the height and width of the editor
  height: "100vh",
  width: "100%",
};
</script>
