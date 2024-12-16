import Swal from 'sweetalert2';

/**
 * Displays a loading alert using SweetAlert2.
 * This alert shows a spinner and prevents the user from interacting with the page until the process is complete.
 * 
 * @param {string} title - The title of the loading modal.
 * @param {string} text - The optional message to display below the title.
 */
export function showLoading(title = "Procesando...", text = "Por favor espere, estamos procesando la solicitud.") {
    Swal.fire({
        title: title,
        text: text,
        iconColor: "#FFF",
        allowOutsideClick: false, // Prevent the user from closing the modal by clicking outside
        showConfirmButton: false, // Hide the confirmation button
        didOpen: () => {
            Swal.showLoading(); // Show the loading spinner
        },
    });
}

/**
 * Hides the currently displayed loading alert.
 * Call this function after the loading process is complete to close the modal.
 */
export function hideLoading() {
    Swal.close(); // Close the SweetAlert2 modal
}
