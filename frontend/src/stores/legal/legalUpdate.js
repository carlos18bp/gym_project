import { defineStore } from 'pinia'
import { get_request, create_request, update_request, delete_request } from '../services/request_http'

export const useLegalUpdateStore = defineStore('legalUpdate', {
  state: () => ({
    updates: [],
    loading: false,
    error: null
  }),

  actions: {
    async fetchActiveUpdates() {
      this.loading = true
      try {
        const response = await get_request('legal-updates/active/')
        this.updates = response.data
        this.error = null
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al cargar las actualizaciones legales'
        console.error('Error fetching legal updates:', error)
      } finally {
        this.loading = false
      }
    },

    async createUpdate(updateData) {
      this.loading = true
      try {
        const formData = new FormData()
        Object.keys(updateData).forEach(key => {
          if (key === 'image' && updateData[key]) {
            formData.append(key, updateData[key])
          } else {
            formData.append(key, updateData[key])
          }
        })

        const response = await create_request('legal-updates/', formData)
        this.updates.unshift(response.data)
        this.error = null
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al crear la actualización legal'
        console.error('Error creating legal update:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateUpdate(id, updateData) {
      this.loading = true
      try {
        const formData = new FormData()
        Object.keys(updateData).forEach(key => {
          if (key === 'image' && updateData[key]) {
            formData.append(key, updateData[key])
          } else {
            formData.append(key, updateData[key])
          }
        })

        const response = await update_request(`legal-updates/${id}/`, formData)
        const index = this.updates.findIndex(update => update.id === id)
        if (index !== -1) {
          this.updates[index] = response.data
        }
        this.error = null
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al actualizar la actualización legal'
        console.error('Error updating legal update:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteUpdate(id) {
      this.loading = true
      try {
        await delete_request(`legal-updates/${id}/`)
        this.updates = this.updates.filter(update => update.id !== id)
        this.error = null
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al eliminar la actualización legal'
        console.error('Error deleting legal update:', error)
        throw error
      } finally {
        this.loading = false
      }
    }
  },

  getters: {
    activeUpdates: (state) => state.updates.filter(update => update.is_active),
    isLoading: (state) => state.loading,
    hasError: (state) => state.error !== null,
    errorMessage: (state) => state.error
  }
}) 