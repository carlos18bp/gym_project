import { ref } from "vue";
import { create_request } from "@/stores/services/request_http";
import { showNotification } from "@/shared/notification_message";
import { showLoading, hideLoading } from "@/shared/loading_message";

/**
 * Composable for sending emails.
 * @returns {object} Functions for sending emails and loading state.
 */
export function useSendEmail() {
  const isLoading = ref(false);
  const errorMessage = ref("");

  /**
   * Sends an email.
   *
   * @param {string} endpoint - The backend endpoint for sending the email.
   * @param {string} toEmail - The recipient's email address.
   * @param {string} [subject] - The email subject (optional).
   * @param {string} [body] - The email body content (optional).
   * @param {File[]} [attachments] - List of attached files (optional).
   * @param {object} [extraParams] - Additional parameters for the backend (optional).
   * @returns {Promise<object>} - Response data from the request.
   * @throws {Error} - Throws an error if the request fails.
   */
  async function sendEmail(
    endpoint,
    toEmail,
    subject = "",
    body = "",
    attachments = [],
    extraParams = {}
  ) {
    if (!toEmail) {
      errorMessage.value = "Recipient email is required.";
      await showNotification(errorMessage.value, "error");
      throw new Error(errorMessage.value);
    }

    // Create a FormData object to handle data and attachments
    const formData = new FormData();
    formData.append("to_email", toEmail);
    formData.append("subject", subject);
    formData.append("body", body);

    // Add attachments to FormData
    attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });

    // Add extra parameters to FormData
    for (const [key, value] of Object.entries(extraParams)) {
      formData.append(key, value);
    }

    try {
      isLoading.value = true;
      errorMessage.value = "";

      // Show loading notification
      showLoading("Sending email...", "Please wait while we send the email.");

      // Send the request to the backend
      const response = await create_request(endpoint, formData);

      // Hide loading notification and show success message
      hideLoading();
      await showNotification("Email sent successfully.", "success");

      return response.data;
    } catch (error) {
      hideLoading(); // Hide loading notification in case of an error
      console.error("Error sending email:", error.message);
      errorMessage.value =
        "An error occurred while sending the email. Please try again.";

      // Show error notification
      await showNotification(errorMessage.value, "error");

      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    sendEmail,
    isLoading,
    errorMessage,
  };
}
