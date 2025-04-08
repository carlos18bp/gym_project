import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { get_request, update_request } from "./services/request_http";
import { registerUserActivity, ACTION_TYPES } from "./activity_feed";

export const useUserStore = defineStore("user", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    users: [],
    dataLoaded: false,
    currentUser: null,
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
     * Get users with role of 'client' and 'lawyer'.
     * @param {object} state - State.
     * @returns {array} - List of users with 'client' and 'lawyer' role.
     */
    clientsAndLawyers: (state) => {
      return state.users.filter(
        (user) => user.role == "client" || user.role == "lawyer"
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
      if (!this.dataLoaded) await this.fetchUsersData();
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
  },
});
