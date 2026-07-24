import Swal from 'sweetalert2'

/**
 * Branded re-offer modal shown when a tour completion went stale
 * (30+ days). Sober look: no icon, brand-styled buttons (classes live
 * in tour.css, always loaded by the composable that calls this).
 *
 * @param {string} message - module confirm message, rendered as title
 * @returns {Promise<boolean>} true when the user accepts the tour
 */
export function showTourOfferAlert(message) {
  return Swal.fire({
    title: message,
    text: 'Te mostramos las secciones principales en menos de un minuto.',
    showCancelButton: true,
    confirmButtonText: 'Ver la guía',
    cancelButtonText: 'Ahora no',
    reverseButtons: true,
    buttonsStyling: false,
    customClass: {
      popup: 'gyj-tour-offer',
      title: 'gyj-tour-offer-title',
      htmlContainer: 'gyj-tour-offer-text',
      actions: 'gyj-tour-offer-actions',
      confirmButton: 'gyj-tour-offer-confirm',
      cancelButton: 'gyj-tour-offer-cancel',
    },
  }).then((result) => result.isConfirmed)
}
