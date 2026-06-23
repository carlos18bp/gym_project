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
 * Handles errors during the Microsoft login process.
 * @param {Object} error - The error object caught during login.
 */
const handleOutlookError = (error) => {
  // User closed or cancelled the Microsoft popup
  if (error && error.errorCode === "user_cancelled") {
    showNotification("Autenticación con Microsoft cancelada", "warning");
    return;
  }

  console.error("Error during Microsoft login:", error);
  showNotification("Error durante el inicio de sesión con Microsoft", "error");
};
