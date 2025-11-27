import { defineStore } from "pinia";
import { 
  get_request, 
  create_request, 
  update_request
} from "../services/request_http";

export const useCorporateRequestsStore = defineStore("corporateRequests", {
  /**
   * Store state for corporate requests management
   * @returns {object} State object
   */
  state: () => ({
    // Requests data
    myRequests: [], // For normal clients
    receivedRequests: [], // For corporate clients
    currentRequest: null,
    
    // Organizations for requests (for normal clients)
    availableOrganizations: [],
    
    // Request types
    requestTypes: [],
    
    // Conversation/responses
    requestResponses: [],
    
    // Loading states
    isLoading: false,
    isLoadingRequests: false,
    isLoadingResponses: false,
    isLoadingTypes: false,
    
    // Pagination
    pagination: {
      count: 0,
      next: null,
      previous: null,
      currentPage: 1,
      pageSize: 10
    },
    
    // Dashboard statistics (for corporate clients)
    dashboardStats: {
      total_requests: 0,
      status_counts: {},
      priority_counts: {},
      recent_requests_count: 0,
      assigned_to_me_count: 0,
      overdue_count: 0
    },
    
    // Filters and search
    filters: {
      status: null,
      priority: null,
      search: '',
      assigned_to_me: false
    },
    
    // Cache control
    dataLoaded: false,
    lastFetchTime: null
  }),

  getters: {
    /**
     * Get request by ID
     * @param {object} state - State
     * @returns {function} Function to find request by ID
     */
    requestById: (state) => (requestId) => {
      const allRequests = [...state.myRequests, ...state.receivedRequests];
      return allRequests.find((request) => request.id === requestId);
    },

    /**
     * Get requests by status
     * @param {object} state - State
     * @returns {function} Function to filter requests by status
     */
    requestsByStatus: (state) => (status) => {
      const allRequests = [...state.myRequests, ...state.receivedRequests];
      return allRequests.filter((request) => request.status === status);
    },

    /**
     * Get high priority requests
     * @param {object} state - State
     * @returns {array} List of high priority requests
     */
    highPriorityRequests: (state) => {
      const allRequests = [...state.myRequests, ...state.receivedRequests];
      return allRequests.filter((request) => 
        request.priority === 'HIGH' || request.priority === 'URGENT'
      );
    },

    /**
     * Get pending requests count
     * @param {object} state - State
     * @returns {number} Number of pending requests
     */
    pendingRequestsCount: (state) => {
      const allRequests = [...state.myRequests, ...state.receivedRequests];
      return allRequests.filter((request) => request.status === 'PENDING').length;
    },

    /**
     * Get request type by ID
     * @param {object} state - State
     * @returns {function} Function to find request type by ID
     */
    requestTypeById: (state) => (typeId) => {
      return state.requestTypes.find((type) => type.id === typeId);
    }
  },

  actions: {
    // ===== NORMAL CLIENT ACTIONS =====

    /**
     * Get organizations available for creating requests (Normal Client only)
     * @returns {Promise<object>} Available organizations
     */
    async getMyOrganizationsForRequests() {
      try {
        this.isLoading = true;
        
        const response = await get_request('corporate-requests/clients/my-organizations/');
        
        if (response.status === 200) {
          this.availableOrganizations = response.data.organizations;
          return response.data;
        }
        
        throw new Error('Error fetching organizations for requests');
      } catch (error) {
        console.error("Error fetching organizations for requests:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Get available request types (Normal Client only)
     * @returns {Promise<array>} Request types list
     */
    async getRequestTypes() {
      try {
        this.isLoadingTypes = true;
        
        const response = await get_request('corporate-requests/clients/request-types/');
        
        if (response.status === 200) {
          // Extract the request_types array from the response
          const requestTypes = response.data.request_types || response.data;
          this.requestTypes = requestTypes;
          return requestTypes;
        }
        
        throw new Error('Error fetching request types');
      } catch (error) {
        console.error("Error fetching request types:", error);
        console.error("Error details:", error.response?.data);
        throw error;
      } finally {
        this.isLoadingTypes = false;
      }
    },

    /**
     * Create a new corporate request (Normal Client only)
     * @param {object} requestData - Request data (organization, request_type, title, description, priority, files)
     * @returns {Promise<object>} Created request data
     */
    async createCorporateRequest(requestData) {
      try {
        this.isLoading = true;
        
        const response = await create_request('corporate-requests/clients/create/', requestData);
        
        if (response.status === 201) {
          const newRequest = response.data.corporate_request;
          this.myRequests.unshift(newRequest);
          this.currentRequest = newRequest;
          return response.data;
        }
        
        throw new Error('Error creating corporate request');
      } catch (error) {
        console.error("Error creating corporate request:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Get requests created by current client (Normal Client only)
     * @param {object} params - Query parameters (status, priority, search, page, page_size)
     * @returns {Promise<object>} Requests list with pagination
     */
    async getMyRequests(params = {}) {
      try {
        this.isLoadingRequests = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `corporate-requests/clients/my-requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.myRequests = response.data.results;
          this.pagination = {
            count: response.data.count,
            next: response.data.next,
            previous: response.data.previous,
            currentPage: params.page || 1,
            pageSize: params.page_size || 10
          };
          this.dataLoaded = true;
          this.lastFetchTime = new Date().toISOString();
          return response.data;
        }
        
        throw new Error('Error fetching my requests');
      } catch (error) {
        console.error("Error fetching my requests:", error);
        throw error;
      } finally {
        this.isLoadingRequests = false;
      }
    },

    /**
     * Get detailed information of a specific request (Normal Client only)
     * @param {number} requestId - Request ID
     * @returns {Promise<object>} Request detailed data
     */
    async getMyRequestDetail(requestId) {
      try {
        this.isLoading = true;
        
        const response = await get_request(`corporate-requests/clients/${requestId}/`);
        
        if (response.status === 200) {
          this.currentRequest = response.data.corporate_request;
          this.requestResponses = response.data.corporate_request.responses || [];
          
          // Update in myRequests list if exists
          const index = this.myRequests.findIndex(req => req.id === requestId);
          if (index >= 0) {
            this.myRequests[index] = response.data.corporate_request;
          }
          
          return response.data;
        }
        
        throw new Error('Request not found');
      } catch (error) {
        console.error("Error fetching request detail:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Add response to a request (Normal Client only)
     * @param {number} requestId - Request ID
     * @param {string} responseText - Response text
     * @returns {Promise<object>} Response data
     */
    async addResponseToMyRequest(requestId, responseData) {
      try {
        this.isLoadingResponses = true;
        
        // Handle both string and object input for backwards compatibility
        const requestBody = typeof responseData === 'string' 
          ? { response_text: responseData }
          : responseData;
        
        const response = await create_request(
          `corporate-requests/clients/${requestId}/responses/`,
          requestBody
        );
        
        if (response.status === 201) {
          const newResponse = response.data.response;
          
          // Update response count and responses in current request
          if (this.currentRequest && this.currentRequest.id === requestId) {
            this.currentRequest.response_count = (this.currentRequest.response_count || 0) + 1;
            if (!this.currentRequest.responses) {
              this.currentRequest.responses = [];
            }
            this.currentRequest.responses.push(newResponse);
          } else {
            // Fallback: keep requestResponses in sync when there is no currentRequest
            this.requestResponses.push(newResponse);
          }
          
          return response.data;
        }
        
        throw new Error('Error adding response');
      } catch (error) {
        console.error("Error adding response:", error);
        throw error;
      } finally {
        this.isLoadingResponses = false;
      }
    },

    // ===== CORPORATE CLIENT ACTIONS =====

    /**
     * Get requests received by corporate client
     * @param {object} params - Query parameters (status, priority, search, assigned_to_me, page, page_size)
     * @returns {Promise<object>} Received requests with pagination
     */
    async getReceivedRequests(params = {}) {
      try {
        this.isLoadingRequests = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `corporate-requests/corporate/received/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.receivedRequests = response.data.results;
          this.pagination = {
            count: response.data.count,
            next: response.data.next,
            previous: response.data.previous,
            currentPage: params.page || 1,
            pageSize: params.page_size || 10
          };
          this.dataLoaded = true;
          this.lastFetchTime = new Date().toISOString();
          return response.data;
        }
        
        throw new Error('Error fetching received requests');
      } catch (error) {
        console.error("Error fetching received requests:", error);
        throw error;
      } finally {
        this.isLoadingRequests = false;
      }
    },

    /**
     * Get detailed information of a received request (Corporate Client only)
     * @param {number} requestId - Request ID
     * @returns {Promise<object>} Request detailed data
     */
    async getReceivedRequestDetail(requestId) {
      try {
        this.isLoading = true;
        
        const response = await get_request(`corporate-requests/corporate/${requestId}/`);
        
        if (response.status === 200) {
          this.currentRequest = response.data.corporate_request;
          this.requestResponses = response.data.corporate_request.responses || [];
          
          // Update in receivedRequests list if exists
          const index = this.receivedRequests.findIndex(req => req.id === requestId);
          if (index >= 0) {
            this.receivedRequests[index] = response.data.corporate_request;
          }
          
          return response.data;
        }
        
        throw new Error('Request not found');
      } catch (error) {
        console.error("Error fetching received request detail:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update a received request (Corporate Client only)
     * @param {number} requestId - Request ID
     * @param {object} updateData - Update data (status, assigned_to, estimated_completion_date, actual_completion_date)
     * @returns {Promise<object>} Updated request data
     */
    async updateReceivedRequest(requestId, updateData) {
      try {
        this.isLoading = true;
        
        const response = await update_request(
          `corporate-requests/corporate/${requestId}/update/`,
          updateData
        );
        
        if (response.status === 200) {
          const updatedRequest = response.data.corporate_request;
          this._updateRequestInState(requestId, updatedRequest);
          return response.data;
        }
        
        throw new Error('Error updating request');
      } catch (error) {
        console.error("Error updating request:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Add response to a received request (Corporate Client only)
     * @param {number} requestId - Request ID
     * @param {string} responseText - Response text
     * @param {boolean} isInternalNote - Whether it's an internal note
     * @returns {Promise<object>} Response data
     */
    async addResponseToReceivedRequest(requestId, responseData) {
      try {
        this.isLoadingResponses = true;
        
        // Handle both old and new parameter formats for backwards compatibility
        const requestBody = typeof responseData === 'string'
          ? { response_text: responseData, is_internal_note: false }
          : responseData;
        
        const response = await create_request(
          `corporate-requests/corporate/${requestId}/responses/`,
          requestBody
        );
        
        if (response.status === 201) {
          const newResponse = response.data.response;
          
          // Update response count and responses in current request
          if (this.currentRequest && this.currentRequest.id === requestId) {
            this.currentRequest.response_count = (this.currentRequest.response_count || 0) + 1;
            if (!this.currentRequest.responses) {
              this.currentRequest.responses = [];
            }
            this.currentRequest.responses.push(newResponse);
          } else {
            // Fallback: keep requestResponses in sync when there is no currentRequest
            this.requestResponses.push(newResponse);
          }
          
          return response.data;
        }
        
        throw new Error('Error adding response');
      } catch (error) {
        console.error("Error adding response:", error);
        throw error;
      } finally {
        this.isLoadingResponses = false;
      }
    },

    /**
     * Get dashboard statistics (Corporate Client only)
     * @returns {Promise<object>} Dashboard statistics
     */
    async getDashboardStats() {
      try {
        this.isLoading = true;
        
        const response = await get_request('corporate-requests/corporate/dashboard-stats/');
        
        if (response.status === 200) {
          this.dashboardStats = response.data;
          return response.data;
        }
        
        throw new Error('Error fetching dashboard stats');
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // ===== SHARED ACTIONS =====

    /**
     * Get conversation/responses for a request
     * @param {number} requestId - Request ID
     * @returns {Promise<object>} Conversation data
     */
    async getRequestConversation(requestId) {
      try {
        this.isLoadingResponses = true;
        
        const response = await get_request(`corporate-requests/${requestId}/conversation/`);
        
        if (response.status === 200) {
          this.requestResponses = response.data.responses;
          return response.data;
        }
        
        throw new Error('Error fetching conversation');
      } catch (error) {
        console.error("Error fetching conversation:", error);
        throw error;
      } finally {
        this.isLoadingResponses = false;
      }
    },

    // ===== UTILITY METHODS =====

    /**
     * Update filters and fetch requests accordingly
     * @param {object} newFilters - New filter values
     * @param {string} userRole - User role ('client' or 'corporate_client')
     */
    async updateFilters(newFilters, userRole) {
      this.filters = { ...this.filters, ...newFilters };
      
      const params = {
        status: this.filters.status,
        priority: this.filters.priority,
        search: this.filters.search,
        page: 1 // Reset to first page when filtering
      };
      
      // Add role-specific filters
      if (userRole === 'corporate_client' && this.filters.assigned_to_me) {
        params.assigned_to_me = this.filters.assigned_to_me;
      }
      
      // Fetch appropriate requests based on role
      if (userRole === 'client' || userRole === 'basic') {
        await this.getMyRequests(params);
      } else if (userRole === 'corporate_client') {
        await this.getReceivedRequests(params);
      }
    },

    /**
     * Clear all filters
     */
    clearFilters() {
      this.filters = {
        status: null,
        priority: null,
        search: '',
        assigned_to_me: false
      };
    },

    /**
     * Refresh requests data based on user role
     * @param {string} userRole - User role ('client' or 'corporate_client')
     */
    async refreshRequests(userRole) {
      const params = {
        page: this.pagination.currentPage,
        page_size: this.pagination.pageSize
      };
      
      if (userRole === 'client' || userRole === 'basic') {
        await this.getMyRequests(params);
      } else if (userRole === 'corporate_client') {
        await this.getReceivedRequests(params);
      }
    },

    /**
     * Clear all data from store
     */
    clearAll() {
      this.myRequests = [];
      this.receivedRequests = [];
      this.currentRequest = null;
      this.availableOrganizations = [];
      this.requestTypes = [];
      this.requestResponses = [];
      this.dashboardStats = {
        total_requests: 0,
        status_counts: {},
        priority_counts: {},
        recent_requests_count: 0,
        assigned_to_me_count: 0,
        overdue_count: 0
      };
      this.clearFilters();
      this.dataLoaded = false;
      this.lastFetchTime = null;
    },

    /**
     * Update request in state (helper method)
     * @param {number} requestId - Request ID
     * @param {object} updatedRequest - Updated request data
     */
    _updateRequestInState(requestId, updatedRequest) {
      // Update in myRequests list
      const myRequestIndex = this.myRequests.findIndex(req => req.id === requestId);
      if (myRequestIndex >= 0) {
        this.myRequests[myRequestIndex] = updatedRequest;
      }
      
      // Update in receivedRequests list
      const receivedRequestIndex = this.receivedRequests.findIndex(req => req.id === requestId);
      if (receivedRequestIndex >= 0) {
        this.receivedRequests[receivedRequestIndex] = updatedRequest;
      }
      
      // Update current request if it's the same
      if (this.currentRequest && this.currentRequest.id === requestId) {
        this.currentRequest = updatedRequest;
      }
    },

    /**
     * Get status display name
     * @param {string} status - Status code
     * @returns {string} Status display name
     */
    getStatusDisplay(status) {
      const statusMap = {
        'PENDING': 'Pendiente',
        'IN_REVIEW': 'En Revisión',
        'RESPONDED': 'Respondida',
        'RESOLVED': 'Resuelta',
        'CLOSED': 'Cerrada'
      };
      return statusMap[status] || status;
    },

    /**
     * Get priority display name
     * @param {string} priority - Priority code
     * @returns {string} Priority display name
     */
    getPriorityDisplay(priority) {
      const priorityMap = {
        'LOW': 'Baja',
        'MEDIUM': 'Media',
        'HIGH': 'Alta',
        'URGENT': 'Urgente'
      };
      return priorityMap[priority] || priority;
    },

    /**
     * Get priority color class for UI
     * @param {string} priority - Priority code
     * @returns {string} CSS class for priority color
     */
    getPriorityColorClass(priority) {
      const colorMap = {
        'LOW': 'text-gray-600 bg-gray-100',
        'MEDIUM': 'text-blue-600 bg-blue-100',
        'HIGH': 'text-orange-600 bg-orange-100',
        'URGENT': 'text-red-600 bg-red-100'
      };
      return colorMap[priority] || 'text-gray-600 bg-gray-100';
    },

    /**
     * Get status color class for UI
     * @param {string} status - Status code
     * @returns {string} CSS class for status color
     */
    getStatusColorClass(status) {
      const colorMap = {
        'PENDING': 'text-yellow-600 bg-yellow-100',
        'IN_REVIEW': 'text-blue-600 bg-blue-100',
        'RESPONDED': 'text-purple-600 bg-purple-100',
        'RESOLVED': 'text-green-600 bg-green-100',
        'CLOSED': 'text-gray-600 bg-gray-100'
      };
      return colorMap[status] || 'text-gray-600 bg-gray-100';
    }
  }
});
