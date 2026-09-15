import { defineStore } from "pinia";
import { get_request, create_request } from "./services/request_http";
import { useUserStore } from "./auth/user";

/**
 * Store for the admin data-reassignment module. Every action targets an
 * admin-only backend endpoint; the backend enforces the authorization.
 */
export const useAdminReassignmentStore = defineStore("adminReassignment", {
  state: () => ({
    summary: null,
    loadingSummary: false,
    executing: false,
    error: null,
  }),

  actions: {
    /**
     * Fetch the transfer preview for a source lawyer.
     * @param {number|string} lawyerId - Source lawyer id.
     * @returns {Promise<object>} The summary payload.
     */
    async fetchSummary(lawyerId) {
      this.loadingSummary = true;
      this.error = null;
      try {
        const response = await get_request(
          `admin/reassignment/summary/?lawyer_id=${lawyerId}`
        );
        this.summary = response.data;
        return response.data;
      } catch (error) {
        this.error = error?.response?.data?.detail || "No se pudo cargar el resumen.";
        throw error;
      } finally {
        this.loadingSummary = false;
      }
    },

    /**
     * Execute the reassignment.
     * @param {object} payload
     * @param {number} payload.sourceLawyerId
     * @param {number} payload.targetLawyerId
     * @param {number[]} payload.processIds
     * @param {number[]} payload.documentIds
     * @param {boolean} payload.archiveSource
     * @returns {Promise<object>} The result summary.
     */
    async executeReassignment({
      sourceLawyerId,
      targetLawyerId,
      processIds,
      documentIds,
      archiveSource,
    }) {
      this.executing = true;
      this.error = null;
      try {
        const response = await create_request("admin/reassignment/execute/", {
          source_lawyer_id: sourceLawyerId,
          target_lawyer_id: targetLawyerId,
          process_ids: processIds,
          document_ids: documentIds,
          archive_source: archiveSource,
        });
        // Refresh the user list so is_archived flags (and any selectors)
        // reflect the transfer immediately.
        await useUserStore().fetchUsersData();
        return response.data;
      } catch (error) {
        this.error = error?.response?.data?.detail || "No se pudo completar la reasignación.";
        throw error;
      } finally {
        this.executing = false;
      }
    },

    /**
     * Archive a lawyer without transferring (used from the admin UI).
     * @param {number} lawyerId
     */
    async archiveLawyer(lawyerId) {
      const response = await create_request(`admin/lawyers/${lawyerId}/archive/`, {});
      await useUserStore().fetchUsersData();
      return response.data;
    },

    /**
     * Restore an archived lawyer (reversible).
     * @param {number} lawyerId
     */
    async unarchiveLawyer(lawyerId) {
      const response = await create_request(`admin/lawyers/${lawyerId}/unarchive/`, {});
      await useUserStore().fetchUsersData();
      return response.data;
    },
  },
});
