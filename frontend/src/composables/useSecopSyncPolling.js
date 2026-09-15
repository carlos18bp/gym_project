import { ref } from "vue";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 60;

/**
 * Coordinate a manual or already-running SECOP sync with server-side SyncLog state.
 * @param {object} secopStore - SECOP Pinia store.
 * @param {object} options - Polling configuration and completion callback.
 * @returns {object} Reactive polling state and lifecycle controls.
 */
export function useSecopSyncPolling(secopStore, options = {}) {
  const {
    onSuccess = async () => {},
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options;

  const syncPolling = ref(false);
  let pollTimer = null;
  let pollAttempts = 0;
  let baselineId = null;
  let sawNewLog = false;

  function latestSync() {
    return secopStore.syncStatus?.recent?.[0] || null;
  }

  function stopSyncPolling() {
    clearTimeout(pollTimer);
    pollTimer = null;
    syncPolling.value = false;
  }

  function scheduleSyncPoll() {
    pollTimer = setTimeout(pollSyncStatus, pollIntervalMs);
  }

  function startSyncPolling(initialId, alreadyStarted = false) {
    stopSyncPolling();
    baselineId = initialId ?? null;
    sawNewLog = alreadyStarted;
    pollAttempts = 0;
    syncPolling.value = true;
    scheduleSyncPoll();
  }

  async function pollSyncStatus() {
    if (!syncPolling.value) return;

    pollAttempts += 1;
    try {
      await secopStore.fetchSyncStatus();
      const current = latestSync();
      if (current?.id !== baselineId) sawNewLog = true;

      if (sawNewLog && current?.status === "SUCCESS") {
        stopSyncPolling();
        await onSuccess();
        return;
      }
    } catch {
      // A later status request may recover from a transient network failure.
    }

    if (pollAttempts >= maxAttempts) {
      stopSyncPolling();
      return;
    }
    scheduleSyncPoll();
  }

  async function triggerSync() {
    if (syncPolling.value) return;
    const initialId = latestSync()?.id ?? null;
    syncPolling.value = true;

    try {
      await secopStore.triggerSync();
      startSyncPolling(initialId);
    } catch {
      stopSyncPolling();
    }
  }

  function resumeRunningSync() {
    const current = latestSync();
    if (current?.status === "IN_PROGRESS") {
      startSyncPolling(current.id, true);
    }
  }

  return {
    syncPolling,
    resumeRunningSync,
    stopSyncPolling,
    triggerSync,
  };
}
