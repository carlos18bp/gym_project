import { defineStore } from "pinia";
import { get_request } from "./services/request_http";
import { useAuthStore } from "./auth"; // Asegúrate de importar el store de auth

export const useUserStore = defineStore("user", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    users: [],
    dataLoaded: false,
    currentUser: null, // Definimos currentUser en el estado
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
      if (this.dataLoaded) return;

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
      const authStore = useAuthStore(); // Usar el store de auth
      this.currentUser = this.userById(authStore.userAuth.id) || null; // Asignar el usuario autenticado a currentUser
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
  },
});
