import Swal from 'sweetalert2';

/**
 * Displays a notification using SweetAlert2.
 * @param {string} message - The message to display in the notification.
 * @param {string} icon - The icon to display in the notification (e.g., 'success', 'error', 'warning', 'info').
 */
export function showNotification(message, icon) {
    Swal.fire({
        title: message,
        icon: icon
    });
}
