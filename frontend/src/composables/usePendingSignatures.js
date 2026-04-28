import { ref, computed } from 'vue'
import { get_request } from '@/stores/services/request_http'

export const PENDING_SIGNATURES_ALERTED_KEY = 'pendingSignaturesAlerted'

/**
 * Composable for managing pending signatures count and session-based alerting.
 *
 * Provides:
 * - Pending signatures count from API
 * - Session-based alerting to avoid nagging users
 * - Polling capability for real-time updates
 */
export function usePendingSignatures() {
  // State
  const pendingCount = ref(0)
  const isLoading = ref(false)
  const error = ref(null)

  // Computed properties
  const hasPending = computed(() => pendingCount.value > 0)
  const hasAlertedThisSession = computed(() => {
    return sessionStorage.getItem(PENDING_SIGNATURES_ALERTED_KEY) === 'true'
  })

  /**
   * Fetch pending signatures count from the API
   */
  async function fetchPendingCount() {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await get_request('dynamic-documents/pending-signatures-count/')
      pendingCount.value = response.data?.pending_count || 0
    } catch (err) {
      console.error('Failed to fetch pending signatures count:', err)
      error.value = err.message || 'Failed to fetch pending signatures'
      pendingCount.value = 0
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Mark that we've already alerted the user this session
   * This prevents showing the alert again on page refresh
   */
  function markAlerted() {
    sessionStorage.setItem(PENDING_SIGNATURES_ALERTED_KEY, 'true')
  }

  /**
   * Reset the session alert flag (for testing or manual reset)
   */
  function resetAlertFlag() {
    sessionStorage.removeItem(PENDING_SIGNATURES_ALERTED_KEY)
  }

  /**
   * Check if user should be alerted based on session state
   * Returns true if user has pending signatures and hasn't been alerted this session
   */
  const shouldAlert = computed(() => hasPending.value && !hasAlertedThisSession.value)

  return {
    // State
    pendingCount,
    isLoading,
    error,
    
    // Computed
    hasPending,
    hasAlertedThisSession,
    shouldAlert,
    
    // Methods
    fetchPendingCount,
    markAlerted,
    resetAlertFlag,
  }
}
