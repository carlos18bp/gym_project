import Swal from "sweetalert2";

/**
 * Displays a notification using SweetAlert2 with Tailwind styling.
 * Returns a promise that resolves when the user clicks the OK button.
 * @param {string} message - The message to display in the notification.
 * @param {string} icon - The icon to display in the notification (e.g., 'success', 'error', 'warning', 'info').
 * @returns {Promise<void>} - A promise that resolves when the user confirms the alert.
 */
export function showNotification(message, icon) {
  return Swal.fire({
    title: message,
    icon: icon,
    buttonsStyling: false, // Deactivate the main styles from sweetalert2 for use Tailwind styles
  });
}
