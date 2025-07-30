import { ref } from "vue";
import { get_request } from "@/stores/services/request_http";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useRecentViews } from '@/composables/useRecentViews';

// Reactive state for document preview modal
export const showPreviewModal = ref(false);
export const previewDocumentData = ref({ title: "", content: "" });
const { registerView } = useRecentViews();

/**
 * Opens the preview modal with processed document content.
 * @param {Object} document - The document to preview.
 */
export const openPreviewModal = (document) => {
  let processedContent = document.content;
  
  // Only process variables for specific states
  const statesToProcess = ['Completed', 'PendingSignatures', 'FullySigned'];
  if (statesToProcess.includes(document.state) && document.variables && Array.isArray(document.variables)) {
    document.variables.forEach((variable) => {
      const regex = new RegExp(`{{\s*${variable.name_en}\s*}}`, "g");
      processedContent = processedContent.replace(regex, variable.value || "");
    });
  }

  previewDocumentData.value = {
    title: document.title,
    content: processedContent,
  };
  showPreviewModal.value = true;
  
  // Set this document as the last viewed for visual feedback
  const store = useDynamicDocumentStore();
  if (document && document.id) {
    store.lastUpdatedDocumentId = document.id;
    localStorage.setItem('lastUpdatedDocumentId', document.id.toString());
  }
};

export async function previewDocument(document, store) {
  try {
    // Set last updated document ID to highlight it in the list when returning
    localStorage.setItem('lastUpdatedDocumentId', document.id.toString());
    store.lastUpdatedDocumentId = document.id;
    
    // Navigate to the preview page
    window.location.href = `/dynamic_document/preview/${document.id}`;
  } catch (error) {
    console.error('Error previewing document:', error);
  }
}

/**
 * Utility function to trigger a file download using the API service.
 * 
 * This function makes a GET request to retrieve a file as a blob and 
 * then triggers a download action in the browser.
 *
 * @param {string} url - The API endpoint for the file.
 * @param {string} filename - The filename for the downloaded file.
 * @param {string} mimeType - The MIME type of the file (default: "application/pdf").
 * @throws {Error} Throws an error if the request fails or no data is received.
 */
export const downloadFile = async (url, filename, mimeType = "application/pdf") => {
  let objectUrl = null;
  try {
    // Make a GET request with responseType: "blob"
    const response = await get_request(url, "blob");

    if (!response || !response.data) {
      throw new Error("[ERROR] No response data received.");
    }

    // Check if the response is an error message
    if (response.data instanceof Blob && response.data.size < 1000) {
      const text = await response.data.text();
      if (text.includes("error") || text.includes("Error")) {
        throw new Error(`[ERROR] Server returned error: ${text}`);
      }
    }

    // Convert the response into a Blob
    const blob = new Blob([response.data], { type: mimeType });

    // Create a download link
    const link = document.createElement("a");
    objectUrl = window.URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

  } catch (error) {
    console.error("[ERROR] Error downloading file:", error);
    throw error; // Re-throw the error to be handled by the caller
  } finally {
    // Clean up
    if (objectUrl) {
      window.URL.revokeObjectURL(objectUrl);
    }
    const link = document.querySelector('a[download]');
    if (link) {
      document.body.removeChild(link);
    }
  }
};

