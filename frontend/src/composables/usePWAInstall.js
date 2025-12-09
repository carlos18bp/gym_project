import { ref } from "vue";

// Shared state across all instances (singleton pattern)
// Start with false to always show the button initially
const isAppInstalled = ref(false); // Tracks if the app is installed or running in standalone mode
const deferredPrompt = ref(null); // Stores the 'beforeinstallprompt' event for triggering later
const showInstructionsModal = ref(false); // Controls instructions modal visibility
const currentBrowser = ref('unknown'); // Current browser type
let isInitialized = false; // Ensures initialization runs only once

// Register the beforeinstallprompt listener immediately at module load
// This ensures we catch the event before any component mounts
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt.value = e; // Stores the event for later use
  isAppInstalled.value = false; // Ensure button is visible when prompt is available
});

// Listen for successful app installation
window.addEventListener("appinstalled", () => {
  isAppInstalled.value = true;
  deferredPrompt.value = null;
});

/**
 * Detects the current browser
 */
function detectBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('firefox')) return 'firefox';
  if (userAgent.includes('edg/')) return 'edge';
  if (userAgent.includes('chrome') && !userAgent.includes('edg/')) return 'chrome';
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'safari';
  return 'unknown';
}

/**
 * Checks if the app is running as a PWA in standalone mode or if it's already installed.
 */
function checkIfPWA() {
  // Check multiple indicators of standalone mode
  const isStandalone = window.navigator.standalone || 
                       window.matchMedia("(display-mode: standalone)").matches ||
                       window.matchMedia("(display-mode: window-controls-overlay)").matches ||
                       window.matchMedia("(display-mode: minimal-ui)").matches;
  
  // Also check if running in a webview or installed context
  const isInWebAppiOS = window.navigator.standalone === true;
  const isInWebAppChrome = window.matchMedia('(display-mode: standalone)').matches;
  
  isAppInstalled.value = isStandalone || isInWebAppiOS || isInWebAppChrome;
  
  // Store in localStorage for persistence
  if (isAppInstalled.value) {
    localStorage.setItem('pwa-installed', 'true');
  }
}

/**
 * Initializes PWA (only once)
 */
function initializePWA() {
  if (isInitialized) return;
  
  isInitialized = true;
  currentBrowser.value = detectBrowser();
  
  // Check if previously marked as installed
  const wasInstalled = localStorage.getItem('pwa-installed') === 'true';
  
  // Check current standalone mode
  checkIfPWA();
  
  // If was previously installed, keep it marked as installed
  if (wasInstalled && !isAppInstalled.value) {
    isAppInstalled.value = true;
  }
  
  // Re-check on visibility change (when user returns to the app)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkIfPWA();
    }
  });
}

/**
 * Shows the installation prompt when available.
 * Handles the user's choice to either accept or dismiss the installation.
 * Falls back to manual instructions modal if prompt is not available.
 */
function promptInstall() {
  if (deferredPrompt.value) {
    // Standard PWA installation for Chromium-based browsers (Chrome, Edge)
    // This provides the native installation experience
    deferredPrompt.value.prompt();
    deferredPrompt.value.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        isAppInstalled.value = true;
      }
      deferredPrompt.value = null; // Clears the prompt after it's used
    });
  } else {
    // Fallback for browsers that don't support beforeinstallprompt
    // or when the prompt is not available (Firefox, Safari, or already dismissed)
    showInstructionsModal.value = true;
  }
}

/**
 * Closes the instructions modal
 */
function closeInstructionsModal() {
  showInstructionsModal.value = false;
}

/**
 * Custom hook to manage Progressive Web App (PWA) installation prompt
 * and detect if the app is running in standalone mode.
 *
 * @returns {Object} isAppInstalled - Indicates if the app is installed or in standalone mode.
 * @returns {Object} showInstructionsModal - Controls modal visibility.
 * @returns {Object} currentBrowser - Current browser type.
 * @returns {Function} promptInstall - Triggers the installation prompt.
 */
export function usePWAInstall() {
  // Initialize PWA on first use
  initializePWA();

  return {
    isAppInstalled, // Indicates if the app is in standalone mode or installed
    showInstructionsModal, // Controls instructions modal visibility
    currentBrowser, // Current browser type
    promptInstall, // Function to trigger the installation prompt
    closeInstructionsModal, // Function to close the instructions modal
  };
}
