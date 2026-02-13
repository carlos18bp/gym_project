import { defineStore } from "pinia";
import { 
  get_request, 
  create_request, 
  update_request, 
  delete_request, 
  upload_file_request 
} from "../services/request_http";

export const useOrganizationsStore = defineStore("organizations", {
  /**
   * Store state for organizations management
   * @returns {object} State object
   */
  state: () => ({
    // Organizations data
    organizations: [],
    currentOrganization: null,
    myMemberships: [],
    
    // Invitations data
    invitations: [],
    myInvitations: [],
    
    // Members data
    organizationMembers: [],
    
    // Loading states
    isLoading: false,
    isLoadingInvitations: false,
    isLoadingMembers: false,
    
    // Pagination and filters
    pagination: {
      count: 0,
      next: null,
      previous: null,
      currentPage: 1,
      pageSize: 10
    },
    
    // Statistics
    organizationStats: {
      total_organizations: 0,
      total_members: 0,
      total_pending_invitations: 0,
      recent_requests_count: 0,
      active_organizations_count: 0,
      organizations_by_status: {},
      recent_invitations_count: 0
    },
    
    // Cache control
    dataLoaded: false,
    lastFetchTime: null
  }),

  getters: {
    /**
     * Get organization by ID
     * @param {object} state - State
     * @returns {function} Function to find organization by ID
     */
    organizationById: (state) => (organizationId) => {
      return state.organizations.find((org) => org.id === organizationId);
    },

    /**
     * Get active organizations
     * @param {object} state - State
     * @returns {array} List of active organizations
     */
    activeOrganizations: (state) => {
      return state.organizations.filter((org) => org.is_active);
    },

    /**
     * Get pending invitations
     * @param {object} state - State
     * @returns {array} List of pending invitations
     */
    pendingInvitations: (state) => {
      return state.myInvitations.filter((invitation) => invitation.status === "PENDING");
    },

    /**
     * Check if user can respond to invitation
     * @param {object} state - State
     * @returns {function} Function to check if invitation can be responded
     */
    canRespondToInvitation: (state) => (invitationId) => {
      const invitation = state.myInvitations.find((inv) => inv.id === invitationId);
      return invitation && invitation.can_be_responded && !invitation.is_expired;
    }
  },

  actions: {
    // ===== ORGANIZATIONS MANAGEMENT =====

    /**
     * Create a new organization (Corporate Client only)
     * @param {object} organizationData - Organization data
     * @returns {Promise<object>} Created organization data
     */
    async createOrganization(organizationData) {
      try {
        this.isLoading = true;
        
        // If there are files, use FormData
        if (organizationData.profile_image || organizationData.cover_image) {
          const formData = new FormData();
          
          // Add text fields
          Object.keys(organizationData).forEach(key => {
            if (key !== 'profile_image' && key !== 'cover_image' && organizationData[key] !== null) {
              formData.append(key, organizationData[key]);
            }
          });
          
          // Add files
          if (organizationData.profile_image) {
            formData.append('profile_image', organizationData.profile_image);
          }
          if (organizationData.cover_image) {
            formData.append('cover_image', organizationData.cover_image);
          }
          
          const response = await upload_file_request('organizations/create/', formData);
          
          if (response.status === 201) {
            const newOrg = response.data.organization;
            this.organizations.unshift(newOrg);
            this.currentOrganization = newOrg;
            return response.data;
          }
        } else {
          // Regular JSON request
          const response = await create_request('organizations/create/', organizationData);
          
          if (response.status === 201) {
            const newOrg = response.data.organization;
            this.organizations.unshift(newOrg);
            this.currentOrganization = newOrg;
            return response.data;
          }
        }
        
        throw new Error('Error creating organization');
      } catch (error) {
        console.error("Error creating organization:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Get organizations led by current corporate client
     * @param {object} params - Query parameters (search, is_active, page, page_size)
     * @returns {Promise<object>} Organizations list with pagination
     */
    async getMyOrganizations(params = {}) {
      try {
        this.isLoading = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `organizations/my-organizations/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.organizations = response.data.results;
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
        
        throw new Error('Error fetching organizations');
      } catch (error) {
        console.error("Error fetching organizations:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Get detailed information of a specific organization
     * @param {number} organizationId - Organization ID
     * @returns {Promise<object>} Organization detailed data
     */
    async getOrganizationDetail(organizationId) {
      try {
        this.isLoading = true;
        
        const response = await get_request(`organizations/${organizationId}/`);
        
        if (response.status === 200) {
          this.currentOrganization = response.data;
          
          // Update in organizations list if exists
          const index = this.organizations.findIndex(org => org.id === organizationId);
          if (index >= 0) {
            this.organizations[index] = response.data;
          }
          
          return response.data;
        }
        
        throw new Error('Organization not found');
      } catch (error) {
        console.error("Error fetching organization detail:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update an existing organization
     * @param {number} organizationId - Organization ID
     * @param {object} updateData - Data to update
     * @returns {Promise<object>} Updated organization data
     */
    async updateOrganization(organizationId, updateData) {
      try {
        this.isLoading = true;
        
        // If there are files, use FormData
        if (updateData.profile_image || updateData.cover_image) {
          const formData = new FormData();
          
          // Add text fields
          Object.keys(updateData).forEach(key => {
            if (key !== 'profile_image' && key !== 'cover_image' && updateData[key] !== null) {
              formData.append(key, updateData[key]);
            }
          });
          
          // Add files
          if (updateData.profile_image) {
            formData.append('profile_image', updateData.profile_image);
          }
          if (updateData.cover_image) {
            formData.append('cover_image', updateData.cover_image);
          }
          
          const response = await upload_file_request(`organizations/${organizationId}/update/`, formData);
          
          if (response.status === 200) {
            const updatedOrg = response.data.organization;
            this._updateOrganizationInState(organizationId, updatedOrg);
            return response.data;
          }
        } else {
          // Regular JSON request
          const response = await update_request(`organizations/${organizationId}/update/`, updateData);
          
          if (response.status === 200) {
            const updatedOrg = response.data.organization;
            this._updateOrganizationInState(organizationId, updatedOrg);
            return response.data;
          }
        }
        
        throw new Error('Error updating organization');
      } catch (error) {
        console.error("Error updating organization:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Delete an organization
     * @param {number} organizationId - Organization ID
     * @returns {Promise<object>} Deletion response
     */
    async deleteOrganization(organizationId) {
      try {
        this.isLoading = true;
        
        const response = await delete_request(`organizations/${organizationId}/delete/`);
        
        if (response.status === 200) {
          // Remove from state
          this.organizations = this.organizations.filter(org => org.id !== organizationId);
          if (this.currentOrganization && this.currentOrganization.id === organizationId) {
            this.currentOrganization = null;
          }
          return response.data;
        }
        
        throw new Error('Error deleting organization');
      } catch (error) {
        console.error("Error deleting organization:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // ===== INVITATIONS MANAGEMENT =====

    /**
     * Send invitation to a client (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {object} invitationData - Invitation data (invited_user_email, message)
     * @returns {Promise<object>} Created invitation
     */
    async sendInvitation(organizationId, invitationData) {
      try {
        this.isLoadingInvitations = true;
        
        const response = await create_request(
          `organizations/${organizationId}/invitations/send/`, 
          invitationData
        );
        
        if (response.status === 201) {
          const newInvitation = response.data.invitation;
          this.invitations.unshift(newInvitation);
          return response.data;
        }
        
        throw new Error('Error sending invitation');
      } catch (error) {
        console.error("Error sending invitation:", error);
        throw error;
      } finally {
        this.isLoadingInvitations = false;
      }
    },

    /**
     * Get invitations for an organization (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {object} params - Query parameters (status)
     * @returns {Promise<array>} Invitations list
     */
    async getOrganizationInvitations(organizationId, params = {}) {
      try {
        this.isLoadingInvitations = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `organizations/${organizationId}/invitations/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.invitations = response.data;
          return response.data;
        }
        
        throw new Error('Error fetching invitations');
      } catch (error) {
        console.error("Error fetching invitations:", error);
        throw error;
      } finally {
        this.isLoadingInvitations = false;
      }
    },

    /**
     * Cancel an invitation (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} invitationId - Invitation ID
     * @returns {Promise<object>} Cancellation response
     */
    async cancelInvitation(organizationId, invitationId) {
      try {
        this.isLoadingInvitations = true;
        
        const response = await delete_request(
          `organizations/${organizationId}/invitations/${invitationId}/cancel/`
        );
        
        if (response.status === 200) {
          // Remove from state
          this.invitations = this.invitations.filter(inv => inv.id !== invitationId);
          return response.data;
        }
        
        throw new Error('Error canceling invitation');
      } catch (error) {
        console.error("Error canceling invitation:", error);
        throw error;
      } finally {
        this.isLoadingInvitations = false;
      }
    },

    /**
     * Get invitations received by current client (Normal Client only)
     * @param {object} params - Query parameters (status)
     * @returns {Promise<object>} Invitations list with pagination
     */
    async getMyInvitations(params = {}) {
      try {
        this.isLoadingInvitations = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `invitations/my-invitations/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.myInvitations = response.data.results;
          this.pagination = {
            count: response.data.count,
            next: response.data.next,
            previous: response.data.previous,
            currentPage: params.page || 1,
            pageSize: params.page_size || 10
          };
          return response.data;
        }
        
        throw new Error('Error fetching my invitations');
      } catch (error) {
        console.error("Error fetching my invitations:", error);
        throw error;
      } finally {
        this.isLoadingInvitations = false;
      }
    },

    /**
     * Respond to an invitation (Normal Client only)
     * @param {number} invitationId - Invitation ID
     * @param {string} action - "accept" or "reject"
     * @returns {Promise<object>} Response data
     */
    async respondToInvitation(invitationId, action) {
      try {
        this.isLoadingInvitations = true;
        
        const response = await create_request(
          `invitations/${invitationId}/respond/`, 
          { action }
        );
        
        if (response.status === 200) {
          // Update invitation in state
          const index = this.myInvitations.findIndex(inv => inv.id === invitationId);
          if (index >= 0) {
            this.myInvitations[index] = response.data.invitation;
          }
          
          // If accepted, refresh memberships
          if (action === 'accept') {
            await this.getMyMemberships();
          }
          
          return response.data;
        }
        
        throw new Error('Error responding to invitation');
      } catch (error) {
        console.error("Error responding to invitation:", error);
        throw error;
      } finally {
        this.isLoadingInvitations = false;
      }
    },

    // ===== MEMBERSHIPS MANAGEMENT =====

    /**
     * Get organizations where current client is a member (Normal Client only)
     * @returns {Promise<object>} Memberships data
     */
    async getMyMemberships() {
      try {
        this.isLoading = true;
        
        const response = await get_request('organizations/my-memberships/');
        
        if (response.status === 200) {
          this.myMemberships = response.data.organizations;
          return response.data;
        }
        
        throw new Error('Error fetching memberships');
      } catch (error) {
        console.error("Error fetching memberships:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Leave an organization (Normal Client only)
     * @param {number} organizationId - Organization ID
     * @returns {Promise<object>} Response data
     */
    async leaveOrganization(organizationId) {
      try {
        this.isLoading = true;
        
        const response = await create_request(`organizations/${organizationId}/leave/`, {});
        
        if (response.status === 200) {
          // Remove from memberships
          this.myMemberships = this.myMemberships.filter(org => org.id !== organizationId);
          return response.data;
        }
        
        throw new Error('Error leaving organization');
      } catch (error) {
        console.error("Error leaving organization:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // ===== MEMBERS MANAGEMENT =====

    /**
     * Get members of an organization (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {object} params - Query parameters (is_active, role)
     * @returns {Promise<array>} Members list
     */
    async getOrganizationMembers(organizationId, params = {}) {
      try {
        this.isLoadingMembers = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `organizations/${organizationId}/members/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.organizationMembers = response.data.members || [];
          return response.data.members || [];
        }
        
        throw new Error('Error fetching members');
      } catch (error) {
        console.error("Error fetching members:", error);
        throw error;
      } finally {
        this.isLoadingMembers = false;
      }
    },

    /**
     * Remove a member from organization (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} userId - User ID to remove
     * @returns {Promise<object>} Response data
     */
    async removeMember(organizationId, userId) {
      try {
        this.isLoadingMembers = true;
        
        const response = await delete_request(
          `organizations/${organizationId}/members/${userId}/remove/`
        );
        
        if (response.status === 200) {
          // Remove from members list
          this.organizationMembers = this.organizationMembers.filter(member => member.id !== userId);
          return response.data;
        }
        
        throw new Error('Error removing member');
      } catch (error) {
        console.error("Error removing member:", error);
        throw error;
      } finally {
        this.isLoadingMembers = false;
      }
    },

    // ===== STATISTICS =====

    /**
     * Get organizations statistics (Corporate Client only)
     * @returns {Promise<object>} Statistics data
     */
    async getOrganizationStats() {
      try {
        this.isLoading = true;
        
        const response = await get_request('organizations/stats/');
        
        if (response.status === 200) {
          this.organizationStats = response.data;
          return response.data;
        }
        
        throw new Error('Error fetching statistics');
      } catch (error) {
        console.error("Error fetching statistics:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // ===== SHARED ENDPOINTS =====

    /**
     * Get public information of an organization
     * @param {number} organizationId - Organization ID
     * @returns {Promise<object>} Public organization data
     */
    async getOrganizationPublicInfo(organizationId) {
      try {
        this.isLoading = true;
        
        const response = await get_request(`organizations/${organizationId}/public/`);
        
        if (response.status === 200) {
          return response.data;
        }
        
        throw new Error('Error fetching public organization info');
      } catch (error) {
        console.error("Error fetching public organization info:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // ===== UTILITY METHODS =====

    /**
     * Clear all data from store
     */
    clearAll() {
      this.organizations = [];
      this.currentOrganization = null;
      this.myMemberships = [];
      this.invitations = [];
      this.myInvitations = [];
      this.organizationMembers = [];
      this.organizationStats = {
        total_organizations: 0,
        total_members: 0,
        total_pending_invitations: 0,
        recent_requests_count: 0,
        active_organizations_count: 0,
        organizations_by_status: {},
        recent_invitations_count: 0
      };
      this.dataLoaded = false;
      this.lastFetchTime = null;
    },

    /**
     * Update organization in state (helper method)
     * @param {number} organizationId - Organization ID
     * @param {object} updatedOrg - Updated organization data
     */
    _updateOrganizationInState(organizationId, updatedOrg) {
      // Update in organizations list
      const index = this.organizations.findIndex(org => org.id === organizationId);
      if (index >= 0) {
        this.organizations[index] = updatedOrg;
      }
      
      // Update current organization if it's the same
      if (this.currentOrganization && this.currentOrganization.id === organizationId) {
        this.currentOrganization = updatedOrg;
      }
      
      // Update in memberships if exists
      const membershipIndex = this.myMemberships.findIndex(org => org.id === organizationId);
      if (membershipIndex >= 0) {
        this.myMemberships[membershipIndex] = updatedOrg;
      }
    }
  }
});
