import { defineStore } from 'pinia'
import axios from 'axios'
import { get_request, create_request, update_request, delete_request } from '../services/request_http'

export const useLegalRequestsStore = defineStore('legalRequestsManagement', {
  state: () => ({
    requests: [],
    currentRequest: null,
    loading: false,
    error: null,
    userRole: 'client'
  }),

  getters: {
    /**
     * Get requests filtered by status
     */
    getRequestsByStatus: (state) => (status) => {
      return state.requests.filter(request => request.status === status)
    },

    /**
     * Get pending requests count
     */
    pendingRequestsCount: (state) => {
      return state.requests.filter(request => request.status === 'PENDING').length
    },

    /**
     * Get requests with responses
     */
    requestsWithResponses: (state) => {
      return state.requests.filter(request => request.response_count > 0)
    }
  },

  actions: {
    /**
     * Fetch legal requests with optional filters
     */
    async fetchRequests(params = {}) {
      this.loading = true
      this.error = null

      try {
        const queryParams = new URLSearchParams()
        
        if (params.search) queryParams.append('search', params.search)
        if (params.status) queryParams.append('status', params.status)
        if (params.page) queryParams.append('page', params.page)
        if (params.date_from) queryParams.append('date_from', params.date_from)
        if (params.date_to) queryParams.append('date_to', params.date_to)

        const url = `legal_requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`
        const response = await get_request(url)

        if (response.status === 200) {
          this.requests = response.data.requests
          this.userRole = response.data.user_role
          
          
          return {
            requests: response.data.requests,
            count: response.data.count,
            userRole: response.data.user_role
          }
        }

        throw new Error('Failed to fetch requests')

      } catch (error) {
        this.error = error.message
        console.error('Error fetching legal requests:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Get detailed information about a specific request
     */
    async fetchRequestDetail(requestId) {
      this.loading = true
      this.error = null

      try {
        const response = await get_request(`legal_requests/${requestId}/`)

        if (response.status === 200) {
          this.currentRequest = response.data
          return response.data
        }

        throw new Error('Failed to fetch request detail')

      } catch (error) {
        this.error = error.message
        console.error('Error fetching request detail:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Update the status of a legal request (lawyers only)
     */
    async updateRequestStatus(requestId, newStatus) {
      try {
        const response = await update_request(
          `legal_requests/${requestId}/status/`,
          { status: newStatus }
        )

        if (response.status === 200) {
          // Update the request in the local state
          const requestIndex = this.requests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            this.requests[requestIndex] = { 
              ...this.requests[requestIndex], 
              status: newStatus,
              status_display: response.data.request.status_display
            }
          }

          // Update current request if it's the same one
          if (this.currentRequest && this.currentRequest.id === requestId) {
            this.currentRequest = response.data.request
          }

          return response.data.request
        }

        throw new Error('Failed to update request status')

      } catch (error) {
        console.error('Error updating request status:', error)
        throw error
      }
    },

    /**
     * Create a response to a legal request
     */
    async createResponse(requestId, responseText) {
      try {
        const formData = new FormData()
        formData.append('response_text', responseText)

        const response = await create_request(
          `legal_requests/${requestId}/responses/`,
          formData
        )

        if (response.status === 201) {
          // Update the current request with the new response
          if (this.currentRequest && this.currentRequest.id === requestId) {
            if (!this.currentRequest.responses) {
              this.currentRequest.responses = []
            }
            this.currentRequest.responses.push(response.data.response)
          }

          // Update response count in requests list
          const requestIndex = this.requests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            this.requests[requestIndex].response_count += 1
          }

          return response.data.response
        }

        throw new Error('Failed to create response')

      } catch (error) {
        console.error('Error creating response:', error)
        throw error
      }
    },

    /**
     * Delete a legal request (lawyers only)
     */
    async deleteRequest(requestId) {
      try {
        const response = await delete_request(
          `legal_requests/${requestId}/delete/`
        )
        console.log(`✅ Delete response status: ${response.status}`, response.data)

        if (response.status === 200 || response.status === 204) {
          // Remove from local state
          this.requests = this.requests.filter(r => r.id !== requestId)
          
          // Clear current request if it's the deleted one
          if (this.currentRequest && this.currentRequest.id === requestId) {
            this.currentRequest = null
          }

          return true
        }

        throw new Error(`Failed to delete request: Status ${response.status}`)

      } catch (error) {
        console.error('Error deleting request:', error)
        
        // Log detailed error information
        if (error.response) {
          console.error('Response status:', error.response.status)
          console.error('Response data:', error.response.data)
        }
        
        // Re-throw with more context
        const errorMessage = error.response?.data?.detail || 
                           error.response?.data?.message || 
                           error.message || 
                           'Error desconocido al eliminar la solicitud'
        
        throw new Error(errorMessage)
      }
    },


    /**
     * Add files to an existing legal request
     */
    async addFilesToRequest(requestId, files) {
      try {
        const formData = new FormData()
        
        // Add all files to FormData
        files.forEach(file => {
          formData.append('files', file)
        })

        const response = await create_request(
          `legal_requests/${requestId}/files/`,
          formData
        )

        if (response.status === 200) {
          // Update the current request with new files if it exists
          if (this.currentRequest && this.currentRequest.id === requestId) {
            // Refresh the request to get updated files
            await this.fetchRequestDetail(requestId)
          }

          return {
            success: true,
            data: response.data,
            message: response.data.message
          }
        }

        throw new Error('Failed to add files')

      } catch (error) {
        console.error('Error adding files to request:', error)
        throw error
      }
    },

    /**
     * Download a file from a legal request
     */
    async downloadFile(requestId, fileId) {
      try {
        // Use axios directly for file downloads to ensure proper binary handling
        const token = localStorage.getItem("token")
        const headers = {
          ...(token && { "Authorization": `Bearer ${token}` }),
          'Accept': 'application/octet-stream, */*'
        }

        const response = await axios.get(
          `/api/legal_requests/${requestId}/files/${fileId}/download/`,
          {
            responseType: 'arraybuffer', // Critical for binary data
            timeout: 30000,
            headers
          }
        )

        if (response.status === 200) {
          return response
        }

        throw new Error(`Failed to download file: HTTP ${response.status}`)

      } catch (error) {
        console.error('Error downloading file:', error)
        throw error
      }
    },

  }
})
