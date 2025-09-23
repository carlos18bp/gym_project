import { defineStore } from "pinia";
import { 
  get_request, 
  create_request, 
  update_request,
  delete_request
} from "../services/request_http";

export const useOrganizationPostsStore = defineStore("organizationPosts", {
  /**
   * Store state for organization posts management
   * @returns {object} State object
   */
  state: () => ({
    // Posts data
    managementPosts: [], // For corporate clients (all posts)
    publicPosts: [], // For members (only active posts)
    currentPost: null,
    
    // Loading states
    isLoading: false,
    isLoadingPosts: false,
    isCreatingPost: false,
    isUpdatingPost: false,
    isDeletingPost: false,
    
    // Pagination
    pagination: {
      count: 0,
      next: null,
      previous: null,
      currentPage: 1,
      pageSize: 10
    },
    
    // Filters
    filters: {
      is_active: null,
      is_pinned: null,
      search: '',
      page: 1,
      page_size: 10
    }
  }),

  getters: {
    /**
     * Get pinned posts first, then by creation date
     */
    sortedManagementPosts: (state) => {
      return [...state.managementPosts].sort((a, b) => {
        // Pinned posts first
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        
        // Then by creation date (newest first)
        return new Date(b.created_at) - new Date(a.created_at);
      });
    },

    /**
     * Get sorted public posts (pinned first, then by date)
     */
    sortedPublicPosts: (state) => {
      return [...state.publicPosts].sort((a, b) => {
        // Pinned posts first
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        
        // Then by creation date (newest first)
        return new Date(b.created_at) - new Date(a.created_at);
      });
    },

    /**
     * Get active posts count
     */
    activePostsCount: (state) => {
      return state.managementPosts.filter(post => post.is_active).length;
    },

    /**
     * Get pinned posts count
     */
    pinnedPostsCount: (state) => {
      return state.managementPosts.filter(post => post.is_pinned).length;
    }
  },

  actions: {
    /**
     * Create a new organization post (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {object} postData - Post data (title, content, link_name, link_url, is_pinned)
     * @returns {Promise<object>} Created post data
     */
    async createPost(organizationId, postData) {
      try {
        this.isCreatingPost = true;
        
        const response = await create_request(
          `organizations/${organizationId}/posts/create/`,
          postData
        );
        
        if (response.status === 201) {
          const newPost = response.data.post;
          this.managementPosts.unshift(newPost); // Add to beginning
          this.currentPost = newPost;
          
          return response.data;
        }
        
        throw new Error('Error creating post');
      } catch (error) {
        console.error("Error creating post:", error);
        throw error;
      } finally {
        this.isCreatingPost = false;
      }
    },

    /**
     * Get posts for management (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {object} params - Query parameters (is_active, is_pinned, search, page, page_size)
     * @returns {Promise<object>} Posts list with pagination
     */
    async getManagementPosts(organizationId, params = {}) {
      try {
        this.isLoadingPosts = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `organizations/${organizationId}/posts/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.managementPosts = response.data.results || response.data;
          
          // Update pagination if available
          if (response.data.count !== undefined) {
            this.pagination = {
              count: response.data.count,
              next: response.data.next,
              previous: response.data.previous,
              currentPage: params.page || 1,
              pageSize: params.page_size || 10
            };
          }
          
          return response.data;
        }
        
        throw new Error('Error fetching management posts');
      } catch (error) {
        console.error("Error fetching management posts:", error);
        throw error;
      } finally {
        this.isLoadingPosts = false;
      }
    },

    /**
     * Get public posts (for organization members)
     * @param {number} organizationId - Organization ID
     * @param {object} params - Query parameters (search, page, page_size)
     * @returns {Promise<object>} Public posts list
     */
    async getPublicPosts(organizationId, params = {}) {
      try {
        this.isLoadingPosts = true;
        
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
            queryParams.append(key, params[key]);
          }
        });
        
        const url = `organizations/${organizationId}/posts/public/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await get_request(url);
        
        if (response.status === 200) {
          this.publicPosts = response.data.results || response.data;
          
          // Update pagination if available
          if (response.data.count !== undefined) {
            this.pagination = {
              count: response.data.count,
              next: response.data.next,
              previous: response.data.previous,
              currentPage: params.page || 1,
              pageSize: params.page_size || 10
            };
          }
          
          return response.data;
        }
        
        throw new Error('Error fetching public posts');
      } catch (error) {
        console.error("Error fetching public posts:", error);
        throw error;
      } finally {
        this.isLoadingPosts = false;
      }
    },

    /**
     * Get detailed information of a specific post (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} postId - Post ID
     * @returns {Promise<object>} Post detailed data
     */
    async getPostDetail(organizationId, postId) {
      try {
        this.isLoading = true;
        
        const response = await get_request(`organizations/${organizationId}/posts/${postId}/`);
        
        if (response.status === 200) {
          this.currentPost = response.data.post || response.data;
          
          // Update in managementPosts list if exists
          const index = this.managementPosts.findIndex(post => post.id === postId);
          if (index >= 0) {
            this.managementPosts[index] = this.currentPost;
          }
          
          return response.data;
        }
        
        throw new Error('Error fetching post detail');
      } catch (error) {
        console.error("Error fetching post detail:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update an organization post (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} postId - Post ID
     * @param {object} postData - Updated post data
     * @returns {Promise<object>} Updated post data
     */
    async updatePost(organizationId, postId, postData) {
      try {
        this.isUpdatingPost = true;
        
        const response = await update_request(
          `organizations/${organizationId}/posts/${postId}/update/`,
          postData
        );
        
        if (response.status === 200) {
          const updatedPost = response.data.post || response.data;
          
          // Update in managementPosts list
          const index = this.managementPosts.findIndex(post => post.id === postId);
          if (index >= 0) {
            this.managementPosts[index] = updatedPost;
          }
          
          // Update currentPost if it's the same
          if (this.currentPost && this.currentPost.id === postId) {
            this.currentPost = updatedPost;
          }
          
          return response.data;
        }
        
        throw new Error('Error updating post');
      } catch (error) {
        console.error("Error updating post:", error);
        throw error;
      } finally {
        this.isUpdatingPost = false;
      }
    },

    /**
     * Delete an organization post (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} postId - Post ID
     * @returns {Promise<object>} Deletion result
     */
    async deletePost(organizationId, postId) {
      try {
        this.isDeletingPost = true;
        
        const response = await delete_request(`organizations/${organizationId}/posts/${postId}/delete/`);
        
        if (response.status === 200 || response.status === 204) {
          // Remove from managementPosts list
          this.managementPosts = this.managementPosts.filter(post => post.id !== postId);
          
          // Clear currentPost if it's the same
          if (this.currentPost && this.currentPost.id === postId) {
            this.currentPost = null;
          }
          
          return response.data || { message: 'Post eliminado exitosamente' };
        }
        
        throw new Error('Error deleting post');
      } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
      } finally {
        this.isDeletingPost = false;
      }
    },

    /**
     * Toggle pin status of a post (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} postId - Post ID
     * @returns {Promise<object>} Updated post data
     */
    async togglePinPost(organizationId, postId) {
      try {
        this.isLoading = true;
        
        const response = await create_request(`organizations/${organizationId}/posts/${postId}/toggle-pin/`, {});
        
        if (response.status === 200) {
          const updatedPost = response.data.post;
          
          // Update in managementPosts list
          const index = this.managementPosts.findIndex(post => post.id === postId);
          if (index >= 0) {
            this.managementPosts[index] = updatedPost;
          }
          
          // Update currentPost if it's the same
          if (this.currentPost && this.currentPost.id === postId) {
            this.currentPost = updatedPost;
          }
          
          return response.data;
        }
        
        throw new Error('Error toggling post pin status');
      } catch (error) {
        console.error("Error toggling post pin status:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Toggle active status of a post (Corporate Client only)
     * @param {number} organizationId - Organization ID
     * @param {number} postId - Post ID
     * @returns {Promise<object>} Updated post data
     */
    async togglePostStatus(organizationId, postId) {
      try {
        this.isLoading = true;
        
        const response = await create_request(`organizations/${organizationId}/posts/${postId}/toggle-status/`, {});
        
        if (response.status === 200) {
          const updatedPost = response.data.post;
          
          // Update in managementPosts list
          const index = this.managementPosts.findIndex(post => post.id === postId);
          if (index >= 0) {
            this.managementPosts[index] = updatedPost;
          }
          
          // Update currentPost if it's the same
          if (this.currentPost && this.currentPost.id === postId) {
            this.currentPost = updatedPost;
          }
          
          return response.data;
        }
        
        throw new Error('Error toggling post status');
      } catch (error) {
        console.error("Error toggling post status:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Set filters for posts
     * @param {object} newFilters - Filter object
     */
    setFilters(newFilters) {
      this.filters = { ...this.filters, ...newFilters };
    },

    /**
     * Clear all filters
     */
    clearFilters() {
      this.filters = {
        is_active: null,
        is_pinned: null,
        search: '',
        page: 1,
        page_size: 10
      };
    },

    /**
     * Clear all posts data
     */
    clearPosts() {
      this.managementPosts = [];
      this.publicPosts = [];
      this.currentPost = null;
      this.pagination = {
        count: 0,
        next: null,
        previous: null,
        currentPage: 1,
        pageSize: 10
      };
    },

    /**
     * Clear all data from store
     */
    clearAll() {
      this.clearPosts();
      this.clearFilters();
      this.isLoading = false;
      this.isLoadingPosts = false;
      this.isCreatingPost = false;
      this.isUpdatingPost = false;
      this.isDeletingPost = false;
    }
  }
});

