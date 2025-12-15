import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { get_request, update_request, create_request, upload_file_request } from "../services/request_http";
import { registerUserActivity, ACTION_TYPES } from "../dashboard/activity_feed";

export const useUserStore = defineStore("user", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    users: [],
    dataLoaded: false,
    currentUser: null,
    userSignature: null,
  }),

  getters: {
    /**
     * Get user by ID.
     * @param {object} state - State.
     * @returns {function} - Function to find user by ID.
     */
    userById: (state) => (userId) => {
      return state.users.find((user) => user.id == userId);
    },

    /**
     * Get users with role of 'client'.
     * @param {object} state - State.
     * @returns {array} - List of users with 'client' role.
     */
    clients: (state) => {
      return state.users.filter((user) => user.role === "client");
    },

    /**
     * Get all client types: 'client', 'basic', and 'corporate_client'.
     * @param {object} state - State.
     * @returns {array} - List of users with client-type roles.
     */
    allClientTypes: (state) => {
      return state.users.filter(
        (user) => user.role === "client" || user.role === "basic" || user.role === "corporate_client"
      );
    },

    /**
     * Get users with role of 'client', 'basic', 'corporate_client' and 'lawyer'.
     * @param {object} state - State.
     * @returns {array} - List of users with 'client', 'basic', 'corporate_client' and 'lawyer' role.
     */
    clientsAndLawyers: (state) => {
      return state.users.filter(
        (user) => user.role == "client" || user.role == "basic" || user.role == "corporate_client" || user.role == "lawyer"
      );
    },

    /**
     * Get current authenticated user.
     * @param {object} state - State.
     * @returns {object|null} - Current user object or null.
     */
    getCurrentUser: (state) => state.currentUser,
  },

  actions: {
    /**
     * Initialize store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) {
        await this.fetchUsersData();
        await this.fetchUserSignature();
      }
    },

    /**
     * Fetch users data from backend.
     */
    async fetchUsersData() {
      try {
        let response = await get_request("users/");
        let jsonData = response.data;

        if (jsonData && typeof jsonData === "string") {
          try {
            jsonData = JSON.parse(jsonData);
          } catch (error) {
            console.error("JSON parse error:", error.message);
            jsonData = [];
          }
        }

        this.users = jsonData ?? [];
        this.dataLoaded = true;
        this.setCurrentUser();
      } catch (error) {
        console.error("Error fetching users data:", error.message);
        this.users = [];
        this.dataLoaded = false;
      }
    },

    /**
     * Set the current user based on authenticated user's ID.
     */
    setCurrentUser() {
      if (!this.currentUser) {
        const authStore = useAuthStore();
        this.currentUser = authStore.userAuth;
      } else {
        return null;
      }
    },

    /**
     * Filter users based on search query.
     * @param {object} state - State.
     * @returns {function} - Function to filter users by search query.
     */
    filteredUsers(searchQuery) {
      if (!searchQuery) return this.clientsAndLawyers;

      const lowerCaseQuery = searchQuery.toLowerCase();

      return this.clientsAndLawyers.filter((user) =>
        ["first_name", "last_name", "identification", "email", "role"].some(
          (field) => user[field]?.toLowerCase().includes(lowerCaseQuery)
        )
      );
    },

    /**
     * Updates user profile information.
     *
     * @param {Object} formData - The user data to be updated.
     * @param {string} formData.first_name - The user's first name.
     * @param {string} formData.last_name - The user's last name.
     * @param {string} formData.contact - The user's contact number.
     * @param {string} formData.identification - The user's identification number.
     * @param {string} formData.birthday - The user's birthdate.
     * @param {string} formData.email - The user's email address.
     * @param {string} formData.document_type - The user's document type.
     * @param {File|string} [formData.photo_profile] - The user's profile photo (File object if new, string if existing).
     * @returns {Promise<number|null>} - The response status code if successful, otherwise null.
     */
    async updateUser(formData) {
      // Create FormData to include the user information
      const formDataObject = new FormData();
      formDataObject.append("first_name", formData.first_name);
      formDataObject.append("last_name", formData.last_name);
      formDataObject.append("contact", formData.contact);
      formDataObject.append("identification", formData.identification);
      formDataObject.append("birthday", formData.birthday);
      formDataObject.append("email", formData.email);
      formDataObject.append("document_type", formData.document_type);

      // Add the profile photo only if a new file was selected
      if (formData.photo_profile instanceof File) {
        formDataObject.append("photo_profile", formData.photo_profile);
      }

      try {
        let response = await update_request(
          `update_profile/${formData.id}/`,
          formDataObject
        );
        
        this.dataLoaded = false; // Reload the data after update
        await this.fetchUsersData();
        
        // Get the current user after update
        const updatedUser = this.userById(formData.id);
        
        // Check if this is the first profile completion or just an update
        if (updatedUser && updatedUser.is_profile_completed) {
          // If this is the first time completing the profile
          if (!this.currentUser.is_profile_completed) {
            await registerUserActivity(
              ACTION_TYPES.CREATE,
              `¡Bienvenido a GYM! Has completado tu perfil exitosamente.`
            );
          } else {
            // Regular profile update
            await registerUserActivity(
              ACTION_TYPES.UPDATE,
              `Actualizaste tu información de perfil.`
            );
          }
        }
        
        return response.status;
      } catch (error) {
        console.error("Error updating user:", error.message);
        return null;
      }
    },

    /**
     * Updates user's electronic signature with traceability data.
     *
     * @param {Object} params - The parameters for signature update.
     * @param {FormData} params.formData - FormData object containing the signature image and method.
     * @param {string|number} params.userId - The ID of the user whose signature is being updated.
     * @returns {Promise<boolean>} - Returns true if successful, false otherwise.
     */
    async updateUserSignature(params) {
      try {
        // Extract parameters
        const { formData, userId } = params;
        
        if (!userId) {
          console.error("No user ID available for signature update");
          return false;
        }
        
        if (!formData || !(formData instanceof FormData)) {
          console.error("Invalid FormData object provided");
          return false;
        }
        
        // Use the specialized upload_file_request function
        const response = await upload_file_request(`users/update_signature/${userId}/`, formData);

        if (response.status === 200 || response.status === 201) {
          // Backend only returns a message here, so fetch the canonical signature
          // representation (including image URL and created_at) from the dedicated endpoint
          await this.fetchUserSignature();

          // Ensure has_signature is in sync for the current user
          if (this.currentUser && this.currentUser.id == userId) {
            this.currentUser.has_signature = true;
          }
          
          // Get the method from formData
          const method = formData.get('method');
          
          // Register the activity
          await registerUserActivity(
            ACTION_TYPES.UPDATE,
            `You have ${method === 'upload' ? 'uploaded' : 'drawn'} your electronic signature.`
          );
          
          return true;
        } else {
          console.error("Signature update failed with status:", response.status);
          return false;
        }
      } catch (error) {
        console.error("Error updating user signature:", error.message);
        if (error.response) {
          console.error("Response data:", error.response.data);
          console.error("Response status:", error.response.status);
        }
        return false;
      }
    },

    /**
     * Get current user info with updated data from backend.
     * @returns {Promise<object|null>} - Updated user object or null if error.
     */
    async getUserInfo() {
      try {
        // If current user isn't set, we can't fetch specific info
        if (!this.currentUser || !this.currentUser.id) {
          return null;
        }
        
        // Get fresh user data from backend
        const response = await get_request(`users/${this.currentUser.id}/`);
        
        if (response.status === 200) {
          // Update store with fresh data
          const userData = response.data;
          
          // Find and update the user in the users array
          const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
          if (userIndex >= 0) {
            this.users[userIndex] = userData;
          }
          
          // Update current user
          this.currentUser = userData;
          
          return userData;
        }
        
        return null;
      } catch (error) {
        console.error("Error fetching user info:", error.message);
        return null;
      }
    },

    /**
     * Fetch all users from the backend
     * @returns {Promise<Array>} - Array of user objects
     */
    async fetchUsers() {
      try {
        const response = await get_request("users/");
        if (response.status === 200) {
          this.users = response.data;
          return this.users;
        }
        return [];
      } catch (error) {
        console.error("Error fetching users:", error);
        return [];
      }
    },

    /**
     * Get users by specific IDs
     * @param {Array<number>} userIds - Array of user IDs to retrieve
     * @returns {Promise<Array>} - Array of matching user objects
     */
    async getUsersByIds(userIds) {
      // If we don't have the complete users list, fetch it first
      if (!this.users || this.users.length === 0) {
        await this.fetchUsers();
      }
      
      // Filter the users by the provided IDs
      return this.users.filter(user => userIds.includes(user.id));
    },

    /**
     * Fetch user's signature data from backend.
     */
    async fetchUserSignature() {
      if (!this.currentUser || !this.currentUser.id) {
        return;
      }

      try {
        const response = await get_request(`users/${this.currentUser.id}/signature/`);

        if (response.status === 200) {
          this.userSignature = response.data;
          // Update has_signature in currentUser
          if (this.currentUser) {
            this.currentUser.has_signature = response.data.has_signature;
          }
        } else {
          this.userSignature = { has_signature: false };
          if (this.currentUser) {
            this.currentUser.has_signature = false;
          }
        }
      } catch (error) {
        console.error("Error fetching user signature:", error.message);
        this.userSignature = { has_signature: false };
        if (this.currentUser) {
          this.currentUser.has_signature = false;
        }
      }
    }
  },
});
