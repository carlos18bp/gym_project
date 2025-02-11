import Swal from 'sweetalert2';

/**
 * Displays a confirmation alert with SweetAlert2 and Tailwind styling.
 * Returns a promise that resolves to `true` if the user confirms, and `false` if the user cancels.
 * @param {string} message - The message to display in the confirmation alert.
 * @returns {Promise<boolean>} - A promise that resolves based on the user's action.
 */
export function showConfirmationAlert(message) {
    return Swal.fire({
        title: message,
        icon: 'question', // Default icon
        showCancelButton: true, // Display both "Accept" and "Cancel" buttons
        confirmButtonText: 'Aceptar', // Text for the accept button
        cancelButtonText: 'Cancelar', // Text for the cancel button
        buttonsStyling: false, // Deactivate default SweetAlert2 styles for Tailwind
    }).then((result) => result.isConfirmed); // Resolve to true if the user clicks "Aceptar"
}
