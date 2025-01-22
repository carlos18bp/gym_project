<template>
  <div>
    <h3>Document List</h3>
    <ul>
      <li v-for="doc in store.documents" :key="doc.id">
        <strong>{{ doc.title }}</strong>
        <!-- Export to PDF button -->
        <button @click="exportToPDF(doc)">Export to PDF</button>
        <!-- Edit button -->
        <button @click="selectDocument(doc)">Edit</button>
        <!-- Delete button -->
        <button @click="deleteDocument(doc.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { jsPDF } from "jspdf";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument"; // Access the document store

const store = useDynamicDocumentStore(); // Initialize the store

// Replace variables with their values in the content
const replaceVariables = (content, values) => {
  let result = content;

  // Replace each variable with its corresponding value
  for (const [key, value] of Object.entries(values || {})) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, value || ""); // Replace variable with its value or empty string
  }

  return result;
};

// Remove HTML tags from content
const stripHTML = (html) => {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || ""; // Extract plain text
};

// Export a document to PDF
const exportToPDF = (doc) => {
  const pdf = new jsPDF();

  // Replace variables and strip HTML
  const replacedContent = replaceVariables(doc.content, doc.values);
  const plainText = stripHTML(replacedContent);

  // Split text into lines and add to PDF
  const lines = pdf.splitTextToSize(plainText, 180); // Adjust width as needed
  lines.forEach((line, index) => {
    pdf.text(line, 10, 10 + index * 10); // Add each line with spacing
  });

  // Save the PDF
  pdf.save(`${doc.title || "Document"}.pdf`);
};

// Select a document for editing
const selectDocument = (doc) => {
  store.selectedDocument = doc; // Update the selected document in the store
};

// Delete a document
const deleteDocument = (id) => {
  if (confirm("Are you sure you want to delete this document?")) {
    store.deleteDocument(id); // Call the delete action from the store
  }
};

// Fetch documents when the component is mounted
store.fetchDocuments();
</script>

<style scoped>
/* Add styling for the document list */
ul {
  list-style: none;
  padding: 0;
}

li {
  margin: 10px 0;
}

button {
  margin-left: 10px;
  padding: 5px 10px;
  cursor: pointer;
}

button:hover {
  background-color: #f0f0f0;
}
</style>
