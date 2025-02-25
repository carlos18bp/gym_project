import { ref } from "vue";
import { get_request } from "@/stores/services/request_http";

// Reactive state for document preview modal
export const showPreviewModal = ref(false);
export const previewDocumentData = ref({ title: "", content: "" });

/**
 * Opens the preview modal with processed document content.
 * @param {Object} document - The document to preview.
 */
export const openPreviewModal = (document) => {
  let processedContent = document.content;
  document.variables.forEach((variable) => {
    const regex = new RegExp(`{{\s*${variable.name_en}\s*}}`, "g");
    processedContent = processedContent.replace(regex, variable.value) || "";
  });

  previewDocumentData.value = {
    title: document.title,
    content: document.assigned_to ? processedContent : document.content,
  };
  showPreviewModal.value = true;
};


/**
 * Utility function to trigger a file download using the API service.
 * 
 * This function makes a GET request to retrieve a file as a blob and 
 * then triggers a download action in the browser.
 *
 * @param {string} url - The API endpoint for the file.
 * @param {string} filename - The filename for the downloaded file.
 * @throws {Error} Throws an error if the request fails or no data is received.
 */
export const downloadFile = async (url, filename, mimeType = "application/pdf") => {
  try {

    // Make a GET request with responseType: "blob"
    const response = await get_request(url, "blob");

    if (!response || !response.data) {
      throw new Error("[ERROR] No response data received.");
    }

    // Convert the response into a Blob
    const blob = new Blob([response.data], { type: mimeType });

    // Create a download link
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("[ERROR] Error downloading file:", error);
  }
};

