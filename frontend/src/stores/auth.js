import axios from "axios";
import { defineStore } from "pinia";
import { useUserStore } from "./user";
import { useProcessStore } from "./process";

// Define the authentication store
export const useAuthStore = defineStore("auth", {
  // State properties
  state: () => ({
    token: localStorage.getItem("token") || null, // Get the token from localStorage or set to null
    userAuth: JSON.parse(localStorage.getItem("userAuth")) || {}, // Get the user authentication details from localStorage or set to an empty object
    signInTries: parseInt(localStorage.getItem("signInTries"), 10) || 0, // Get the Sign In attempts
    signInSecondsAcumulated:
      localStorage.getItem("signInSecondsAcumulated") || 0,
    signInSecondsRemaining: localStorage.getItem("signInSecondsRemaining") || 0, // Get remaining seconds only because user exceeds allowed attempts
    signInIntervalId: localStorage.getItem("signInSecondsAcumulated") || null,
  }),
  // Getter methods
  getters: {
    isAuthenticated: (state) => {
      // Check if the user is authenticated based on the presence of a token and user ID
      if (state.token && state.userAuth.id) {
        return true;
      }
      return false;
    }
  },
  // Action methods
  actions: {
    /**
     * Logs in the user by setting the token and user details.
     * @param {Object} data - The user data containing the access token and user details.
     */
    login(data) {
      this.token = data.access;
      if (this.token) {
        this.userAuth = data.user;
        axios.defaults.headers.common["Authorization"] = `Bearer ${this.token}`;

        // Save to localStorage
        this.saveToLocalStorageAuth();
      } else {
        this.clearAuthorizationHeader();
      }
    },
    /**
     * Logs out the user by clearing the token and user details.
     */
    logout() {
      this.token = null;
      this.userAuth = {};
      this.clearAuthorizationHeader();
      this.removeFromLocalStorage();

      // Reset other stores
      const processStore = useProcessStore();
      const userStore = useUserStore();
      processStore.$reset();
      userStore.$reset();
    },
    /**
     * Saves the token and user authentication details to localStorage.
     */
    saveToLocalStorageAuth() {
      localStorage.setItem("token", this.token);
      localStorage.setItem("userAuth", JSON.stringify(this.userAuth));
    },
    /**
     * Removes the token and user authentication details from localStorage.
     */
    removeFromLocalStorage() {
      // Clear interval if it's running
      if (this.signInIntervalId) {
        clearInterval(this.signInIntervalId);
        localStorage.setItem("signInIntervalId", null);
        this.signInIntervalId = null;
      }

      // Clear state values
      this.signInTries = 0;
      this.signInSecondsAcumulated = 0;
      this.signInSecondsRemaining = 0;

      // Remove from localStorage

      localStorage.setItem("signInTries", 0);
      localStorage.setItem("signInSecondsAcumulated", 0);
      localStorage.setItem("signInSecondsRemaining", 0);
      localStorage.removeItem("token");
      localStorage.removeItem("userAuth");
    },
    /**
     * Clears the authorization header from Axios.
     */
    clearAuthorizationHeader() {
      delete axios.defaults.headers.common["Authorization"];
    },
    /**
     * Saves the Sign In Attemps and Second Remaining to localStorage
     */
    saveToLocalStorageSignIn() {
      localStorage.setItem("signInTries", this.signInTries);
      localStorage.setItem(
        "signInSecondsRemaining",
        this.signInSecondsRemaining
      );
      localStorage.setItem(
        "signInSecondsAcumulated",
        this.signInSecondsAcumulated
      );
    },
    /**
     * Verficate the attemps to Sign In and incrementate the seconds for wait the next 3 attemps
     */
    attempsSignIn(action) {
      if (action != "initial") {
        this.signInTries += 1;
      }

      if (this.signInTries % 3 === 0) {
        if (action != "initial") {
          if (this.signInTries === 3) {
            this.signInSecondsRemaining = 60;
            this.signInSecondsAcumulated = this.signInSecondsRemaining;
          } else {
            this.signInSecondsAcumulated *= 2;
            this.signInSecondsRemaining = this.signInSecondsAcumulated;
          }
        }

        // Clear any previous interval
        if (this.signInIntervalId) {
          clearInterval(this.signInIntervalId);
          localStorage.setItem("signInIntervalId", null);
          this.signInIntervalId = null;
        }

        this.signInIntervalId = setInterval(() => {
          this.signInSecondsRemaining--;
          this.saveToLocalStorageSignIn();
          if (this.signInSecondsRemaining <= 0) {
            clearInterval(this.signInIntervalId);
            localStorage.setItem("signInIntervalId", null);
            this.signInIntervalId = null;
          }
        }, 1000);

        localStorage.setItem("signInIntervalId", this.signInIntervalId);
      }
      this.saveToLocalStorageSignIn();
    },
  },
});
