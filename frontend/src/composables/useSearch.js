// useSearch.js
import { ref, computed, isRef } from 'vue'

export function useSearch(items, fields = []) {
  // Reactive search term
  const searchTerm = ref('')

  // Computed property to return filtered items
  const filteredProcess = computed(() => {
    // Get the actual array (whether items is a ref or not)
    const sourceArray = isRef(items) ? items.value : items

    // If no search term, return all items
    if (!searchTerm.value.trim()) {
      return sourceArray
    }

    const term = searchTerm.value.toLowerCase()

    // Filter by checking if at least one field contains the search term
    return sourceArray.filter(item => {
      return fields.some(field => {
        const fieldValue = item[field]
        return (
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(term)
        )
      })
    })
  })

  return {
    searchTerm,
    filteredProcess
  }
}

