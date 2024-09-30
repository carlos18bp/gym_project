import { defineStore } from "pinia";
import { get_request } from "./services/request_http";

export const useCaseTypeStore = defineStore("case_type", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    caseTypes: [],
    dataLoaded: false,
  }),

  getters: {
    /**
     * Get case_type by ID.
     * @param {object} state - State.
     * @returns {function} - Function to find case_type by ID.
     */
    caseTypeById: (state) => (caseTypeId) => {
      return state.caseTypes.find((caseType) => caseType.id == caseTypeId);
    },
  },

  actions: {
    /**
     * Initialize store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) await this.fetchCaseTypesData();
    },

    /**
     * Fetch caseTypes data from backend.
     */
    async fetchCaseTypesData() {
      if (this.dataLoaded) return;

      try {
        let response = await get_request("case_types/");
        let jsonData = response.data;

        if (jsonData && typeof jsonData === "string") {
          try {
            jsonData = JSON.parse(jsonData);
          } catch (error) {
            console.error("JSON parse error:", error.message);
            jsonData = [];
          }
        }

        this.caseTypes = jsonData ?? [];
        this.dataLoaded = true;
      } catch (error) {
        console.error("Error fetching caseTypes data:", error.message);
        this.caseTypes = [];
        this.dataLoaded = false;
      }
    },
  },
});
