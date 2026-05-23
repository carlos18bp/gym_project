import { ref, computed } from 'vue'
import { get_request } from '@/stores/services/request_http'

/**
 * Composable that surfaces the count of unread, non-archived process-related
 * notifications for the current user.
 *
 * Used by the SlideBar to render a red badge over the "Procesos" item so the
 * user can see at a glance how many process events need their attention.
 *
 * Mirrors the API of `usePendingSignatures` so SlideBar can mount both
 * composables without special-casing.
 */
export function usePendingProcessAlerts() {
  const pendingCount = ref(0)
  const isLoading = ref(false)
  const error = ref(null)

  const hasPending = computed(() => pendingCount.value > 0)

  async function fetchPendingCount() {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await get_request('processes/pending-alerts-count/')
      pendingCount.value = response.data?.pending_count || 0
    } catch (err) {
      console.error('Failed to fetch pending process alerts count:', err)
      error.value = err.message || 'Failed to fetch pending process alerts'
      pendingCount.value = 0
    } finally {
      isLoading.value = false
    }
  }

  return {
    pendingCount,
    isLoading,
    error,
    hasPending,
    fetchPendingCount,
  }
}
