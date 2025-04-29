import axios from "axios";
import { showNotification } from "@/shared/notification_message";
import { decodeCredential } from "vue3-google-login";

/**
 * Handles the login process with Google.
 * @param {Object} response - The response object from Google login.
 * @param {Object} router - The router instance to handle navigation.
 * @param {Object} authStore - The authentication store instance.
 */
export const loginWithGoogle = async (response, router, authStore) => {
  try {
    const decodedCredential = decodeCredential(response.credential);

    // Send the user's email, given_name, and family_name to the backend
    const res = await axios.post("/api/google_login/", {
      email: decodedCredential.email,
      given_name: decodedCredential.given_name,
      family_name: decodedCredential.family_name,
      picture: decodedCredential.picture,
    });

    // Log in the user and save the authentication data
    authStore.login(res.data);
    
    // Check if the user was created or just logged in
    if (res.data.created) {
      showNotification("¡Registro exitoso!", "success");
    } else {
      showNotification("¡Inicio de sesión exitoso!", "success");
    }
    
    router.push({ name: "dashboard" }); // Redirect to the dashboard page
  } catch (error) {
    handleLoginError(error);
  }
};

/**
 * Handles errors during the login process.
 * @param {Object} error - The error object caught during login.
 */
const handleLoginError = (error) => {
  console.error("Error during login:", error);
  showNotification("Error durante el inicio de sesión", "error"); // Show error notification
};
