import axios from "axios";
import { showNotification } from "@/shared/notification_message";
import { signInWithMicrosoft } from "@/shared/msal_config";

/**
 * Handles the login/registration process with Microsoft (Outlook).
 *
 * Opens the Microsoft sign-in popup, then sends the raw ID token to the
 * backend for server-side verification. On success the user is logged in and
 * redirected. Mirrors the Google login flow.
 *
 * @param {Object} router - The router instance to handle navigation.
 * @param {Object} authStore - The authentication store instance.
 * @param {Object} [options] - Optional behavior overrides.
 * @param {Object} [options.redirect] - Route location to push on success.
 * @param {string} [options.successMessageCreated] - Notification when a new account is created.
 * @param {string} [options.successMessageLoggedIn] - Notification when an existing user logs in.
 */
export const loginWithOutlook = async (router, authStore, options = {}) => {
  const {
    redirect = { name: "dashboard" },
    successMessageCreated = "¡Registro exitoso!",
    successMessageLoggedIn = "¡Inicio de sesión exitoso!",
  } = options;

  try {
    // Open the Microsoft popup and obtain the ID token
    const result = await signInWithMicrosoft();

    // Send the raw Microsoft ID token to the backend for server-side verification
    const res = await axios.post("/api/outlook_login/", {
      id_token: result.idToken,
    });

    // Log in the user and save the authentication data
    authStore.login(res.data);

    // Check if the user was created or just logged in
    if (res.data.created) {
      showNotification(successMessageCreated, "success");
    } else {
      showNotification(successMessageLoggedIn, "success");
    }

    router.push(redirect);
  } catch (error) {
    handleOutlookError(error);
  }
};

/**
 * User-facing message for each MSAL error code we can act on. Anything not
 * listed here falls through to the backend message or the generic error.
 */
const MSAL_ERROR_MESSAGES = {
  // User closed or cancelled the Microsoft popup
  user_cancelled: {
    message: "Autenticación con Microsoft cancelada",
    type: "warning",
  },
  // Another Microsoft window is still open for this tab
  interaction_in_progress: {
    message:
      "Ya hay una ventana de Microsoft abierta. Ciérrala e inténtalo de nuevo.",
    type: "warning",
  },
  // The browser refused to open the popup
  popup_window_error: {
    message:
      "Tu navegador bloqueó la ventana de Microsoft. Permite las ventanas emergentes e inténtalo de nuevo.",
    type: "error",
  },
  empty_window_error: {
    message:
      "Tu navegador bloqueó la ventana de Microsoft. Permite las ventanas emergentes e inténtalo de nuevo.",
    type: "error",
  },
};

/**
 * Handles errors during the Microsoft login process.
 * @param {Object} error - The error object caught during login.
 */
const handleOutlookError = (error) => {
  const msalError = error && MSAL_ERROR_MESSAGES[error.errorCode];
  if (msalError) {
    showNotification(msalError.message, msalError.type);
    return;
  }

  // Validation errors from /api/outlook_login/ already carry a readable message
  const backendMessage = error?.response?.data?.error_message;
  if (backendMessage) {
    showNotification(backendMessage, "error");
    return;
  }

  console.error("Error during Microsoft login:", error);
  showNotification("Error durante el inicio de sesión con Microsoft", "error");
};
