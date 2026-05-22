import { ref } from 'vue'
import { get_request } from '@/stores/services/request_http'

/**
 * Composable for the per-tab unread badges of the "Archivos Jurídicos"
 * dashboard.
 *
 * Returns a map of `{ <tab-name>: <unread-notification-count> }` so each tab
 * can surface a red badge for documents with unread activity — not just the
 * "Dcs. Por Firmar" tab. The "pending-signatures" bucket is intentionally
 * unused by the dashboard: that tab keeps its dedicated pending-signatures
 * to-do count from `usePendingSignatures`.
 */
export function useDocumentTabBadges() {
  const tabUnreadCounts = ref({})
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Fetch the unread document-notification counts grouped by dashboard tab.
   */
  async function fetchTabUnreadCounts() {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await get_request('dynamic-documents/document-notification-counts/')
      tabUnreadCounts.value = response.data?.counts || {}
    } catch (err) {
      console.error('Failed to fetch document tab badge counts:', err)
      error.value = err.message || 'Failed to fetch document tab badges'
      tabUnreadCounts.value = {}
    } finally {
      isLoading.value = false
    }
  }

  return {
    tabUnreadCounts,
    isLoading,
    error,
    fetchTabUnreadCounts,
  }
}
