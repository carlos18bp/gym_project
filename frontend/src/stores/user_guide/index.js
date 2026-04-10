import { defineStore } from 'pinia';
import { guideGetters } from './getters.js';
import { dashboardContent, directoryContent } from './content/dashboard_directory.js';
import { processesContent } from './content/processes.js';
import { documentsContent } from './content/documents.js';
import {
  requestsContent,
  appointmentsContent,
  organizationsContent,
  intranetContent,
  authenticationContent,
  subscriptionsContent,
} from './content/services.js';

/**
 * User Guide Store
 *
 * Modular store for the interactive user guide, split by content domain:
 * - Dashboard & Directory
 * - Processes
 * - Documents (largest section)
 * - Services (requests, appointments, organizations, intranet, auth, subscriptions)
 */
export const useUserGuideStore = defineStore('userGuide', {
  state: () => ({
    guideContent: {},
    initialized: false
  }),

  getters: {
    ...guideGetters,
  },

  actions: {
    /**
     * Initialize guide content from sub-modules
     */
    initializeGuideContent() {
      if (this.initialized) return;

      this.guideContent = {
        dashboard: dashboardContent,
        directory: directoryContent,
        processes: processesContent,
        documents: documentsContent,
        requests: requestsContent,
        appointments: appointmentsContent,
        organizations: organizationsContent,
        intranet: intranetContent,
        authentication: authenticationContent,
        subscriptions: subscriptionsContent,
      };

      this.initialized = true;
    }
  }
});
