import { ref } from 'vue';
import { create_request } from '@/stores/services/request_http';
import { showNotification } from '@/shared/notification_message';
import { showLoading, hideLoading } from '@/shared/loading_message';

/**
 * Composable para enviar correos electrónicos.
 * @returns {object} Función para enviar correos y estado de carga.
 */
export function useSendEmail() {
  const isLoading = ref(false);
  const errorMessage = ref('');

  /**
   * Enviar un correo electrónico.
   * @param {string} endpoint - El endpoint del backend para enviar el correo.
   * @param {string} toEmail - El email de destino.
   * @param {string} [subject] - Asunto del correo (opcional).
   * @param {string} [body] - Cuerpo del correo (opcional).
   * @param {File[]} [attachments] - Archivos adjuntos (opcional).
   * @param {object} [extraParams] - Parámetros adicionales para el backend (opcional).
   * @returns {Promise<object>} - Respuesta de la solicitud.
   */
  async function sendEmail(endpoint, toEmail, subject = '', body = '', attachments = [], extraParams = {}) {
    if (!toEmail) {
      errorMessage.value = 'El correo de destino es obligatorio.';
      await showNotification(errorMessage.value, 'error');
      throw new Error(errorMessage.value);
    }

    // Crear un objeto FormData para manejar los datos y archivos adjuntos
    const formData = new FormData();
    formData.append('to_email', toEmail);
    formData.append('subject', subject);
    formData.append('body', body);

    // Agregar los archivos adjuntos al FormData
    attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });

    // Agregar parámetros adicionales al FormData
    for (const [key, value] of Object.entries(extraParams)) {
      formData.append(key, value);
    }

    try {
      isLoading.value = true;
      errorMessage.value = '';

      // Mostrar alerta de carga
      showLoading('Enviando correo...', 'Por favor espere mientras enviamos el correo.');

      // Enviar la solicitud al backend
      const response = await create_request(endpoint, formData);

      // Ocultar alerta de carga y mostrar notificación de éxito
      hideLoading();
      await showNotification('Correo enviado exitosamente.', 'success');

      return response.data;
    } catch (error) {
      hideLoading(); // Ocultar alerta de carga en caso de error
      console.error('Error al enviar el correo:', error.message);
      errorMessage.value = 'Ocurrió un error al enviar el correo. Por favor, intenta nuevamente.';

      // Mostrar notificación de error
      await showNotification(errorMessage.value, 'error');

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
