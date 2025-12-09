// useIdleLogout.js
// Composable to automatically log out the authenticated user after a period of inactivity.
// All documentation and comments are in English as requested.

import { ref } from "vue";
import { googleLogout } from "vue3-google-login";

// List of DOM events that we will treat as user activity
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

// Note: beforeunload event removed due to browser security policies

/**
 * Automatically logs the user out after a given period of inactivity.
 *
 * The composable attaches global listeners to common activity events (mouse, keyboard, touch, scroll).
 * Each event resets an internal timer. If the timer completes without detecting activity, the
 * user is considered idle and `authStore.logout()` is executed together with the Google logout.
 *
 * Because `App.vue` is mounted once for the whole application life-cycle, this composable must be
 * instantiated exactly once. It cleans up all listeners and the timeout on unmount in order to
 * avoid memory leaks.
 *
 * @param {Object}   [options]
 * @param {number}   [options.timeout=900000] – Idle time in milliseconds before logging out. Default: 15 minutes.
 * @returns {{ unsubscribe: Function }} – Function to manually stop the idle watcher (removes listeners and timeout).
 */
export function useIdleLogout({ timeout = 15 * 60 * 1000, router, authStore } = {}) {
  // Router and authStore must be provided explicitly from a valid setup() context
  if (!router || !authStore) {
    throw new Error("useIdleLogout requires both 'router' and 'authStore' instances");
  }
  const timerId = ref(null);

  /**
   * Clears the existing timeout (if any) and starts a new one.
   */
  const resetTimer = () => {
    if (timerId.value) {
      clearTimeout(timerId.value);
    }
    timerId.value = setTimeout(handleIdle, timeout);
  };

  /**
   * Called when the user is considered idle.
   * It executes the logout logic only when the user is currently authenticated.
   */
  const handleIdle = () => {
    if (!authStore.token) return; // Nothing to do if the user is already logged out

    authStore.logout();
    googleLogout();
    router.push({ name: "sign_in" });
  };

  // handleTabClose function removed due to beforeunload event security restrictions

  /**
   * Attaches activity listeners and starts the idle timer.
   */
  const subscribe = () => {
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, true));
    resetTimer(); // Start the initial timer
  };

  /**
   * Removes all activity listeners and clears the idle timer.
   */
  const unsubscribe = () => {
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer, true));
    if (timerId.value) {
      clearTimeout(timerId.value);
      timerId.value = null;
    }
  };

  // Return control functions without automatic lifecycle hooks
  // The caller should handle initialization manually
  return { subscribe, unsubscribe };
} 