import { ref, onMounted } from "vue";

/**
 * Custom hook to manage Progressive Web App (PWA) installation prompt
 * and detect if the app is running in standalone mode.
 *
 * @returns {Object} isAppInstalled - Indicates if the app is installed or in standalone mode.
 * @returns {Function} promptInstall - Triggers the installation prompt.
 */
export function usePWAInstall() {
  const isAppInstalled = ref(false); // Tracks if the app is installed or running in standalone mode
  const deferredPrompt = ref(null); // Stores the 'beforeinstallprompt' event for triggering later

  /**
   * Checks if the app is running as a PWA in standalone mode or if it's already installed.
   */
  function checkIfPWA() {
    isAppInstalled.value =
      window.navigator.standalone ||
      window.matchMedia("(display-mode: standalone)").matches;
  }

  /**
   * Shows the installation prompt when available.
   * Handles the user's choice to either accept or dismiss the installation.
   */
  function promptInstall() {
    if (deferredPrompt.value) {
      deferredPrompt.value.prompt();
      deferredPrompt.value.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the installation");
        } else {
          console.log("User dismissed the installation");
        }
        deferredPrompt.value = null; // Clears the prompt after it's used
      });
    }
  }

  // Captures the 'beforeinstallprompt' event and initializes PWA check on component mount
  onMounted(() => {
    checkIfPWA();
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt.value = e; // Stores the event for later use
    });
  });

  return {
    isAppInstalled, // Indicates if the app is in standalone mode or installed
    promptInstall, // Function to trigger the installation prompt
  };
}
