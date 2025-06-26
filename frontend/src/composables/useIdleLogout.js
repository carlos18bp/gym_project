// useIdleLogout.js
// Composable to automatically log out the authenticated user after a period of inactivity.
// All documentation and comments are in English as requested.

import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { googleLogout } from "vue3-google-login";

// List of DOM events that we will treat as user activity
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

// Event used to detect that the tab or window is being closed or refreshed
const TAB_CLOSE_EVENT = "beforeunload";

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
export function useIdleLogout({ timeout = 15 * 60 * 1000 } = {}) {
  const router = useRouter();
  const authStore = useAuthStore();
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

  /**
   * Called when the user is closing or refreshing the tab.
   * We cannot rely on async operations finishing here, but clearing the local token is enough
   * because it prevents automatic re-authentication and signals other tabs (storage event).
   */
  const handleTabClose = () => {
    if (!authStore.token) return;

    authStore.logout();
    try {
      googleLogout(); // Best-effort; may not complete before the tab actually closes
    } catch (_) {
      /* ignore */
    }
    // No router navigation – the page is about to unload.
  };

  /**
   * Attaches activity listeners and starts the idle timer.
   */
  const subscribe = () => {
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, true));
    window.addEventListener(TAB_CLOSE_EVENT, handleTabClose, true);
    resetTimer(); // Start the initial timer
  };

  /**
   * Removes all activity listeners and clears the idle timer.
   */
  const unsubscribe = () => {
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer, true));
    window.removeEventListener(TAB_CLOSE_EVENT, handleTabClose, true);
    if (timerId.value) {
      clearTimeout(timerId.value);
      timerId.value = null;
    }
  };

  // Lifecycle hooks – subscribe on mount, clean up on unmount
  onMounted(subscribe);
  onBeforeUnmount(unsubscribe);

  return { unsubscribe };
} 