import { defineStore } from "pinia";
import { get_request, create_request, update_request } from "@/stores/services/request_http";

export const useServicesTramitesStore = defineStore("servicesTramites", {
  state: () => ({
    services: [],
    featuredServices: [],
    selectedService: null,
    selectedDraft: null,
    myRequests: [],
    inboxRequests: [],
    selectedRequest: null,
    adminServices: [],
  }),

  actions: {
    async fetchFeaturedServices() {
      const response = await get_request("services/featured/");
      this.featuredServices = response.data.services || [];
      return this.featuredServices;
    },

    async fetchServices(params = {}) {
      const query = new URLSearchParams();
      if (params.include_inactive) {
        query.append("include_inactive", "1");
      }

      const url = `services/${query.toString() ? `?${query.toString()}` : ""}`;
      const response = await get_request(url);
      this.services = response.data.services || [];
      return this.services;
    },

    async fetchServiceDetail(serviceId) {
      const response = await get_request(`services/${serviceId}/`);
      this.selectedService = response.data.service;
      this.selectedDraft = response.data.draft;
      return response.data;
    },

    async fetchLatestDraft(serviceId) {
      const response = await get_request(`service-requests/service/${serviceId}/draft/`);
      this.selectedDraft = response.data.draft;
      return this.selectedDraft;
    },

    async saveServiceRequest({
      serviceId,
      requestId = null,
      answers = [],
      currentStage = 1,
      isSubmit = false,
      filesByField = {},
    }) {
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          service_id: serviceId,
          request_id: requestId,
          answers,
          current_stage: currentStage,
          is_submit: isSubmit,
        })
      );

      Object.entries(filesByField).forEach(([fieldId, files]) => {
        if (!Array.isArray(files)) return;
        files.forEach((file) => {
          formData.append(`field_files_${fieldId}`, file);
        });
      });

      const response = await create_request("service-requests/save/", formData);
      return response.data;
    },

    async fetchMyRequests(filters = {}) {
      const query = new URLSearchParams();
      ["status", "service", "tracking", "date_from", "date_to"].forEach((key) => {
        if (filters[key]) query.append(key, filters[key]);
      });

      const response = await get_request(
        `service-requests/my/${query.toString() ? `?${query.toString()}` : ""}`
      );
      this.myRequests = response.data.results || response.data.requests || [];
      return response.data;
    },

    async fetchInboxRequests(filters = {}) {
      const query = new URLSearchParams();
      ["status", "service", "tracking", "search", "date_from", "date_to"].forEach((key) => {
        if (filters[key]) query.append(key, filters[key]);
      });

      const response = await get_request(
        `service-requests/inbox/${query.toString() ? `?${query.toString()}` : ""}`
      );
      this.inboxRequests = response.data.results || response.data.requests || [];
      return response.data;
    },

    async fetchRequestDetail(requestId) {
      const response = await get_request(`service-requests/${requestId}/`);
      this.selectedRequest = response.data;
      return response.data;
    },

    async manageRequest(requestId, { status, message, file = null }) {
      const formData = new FormData();
      if (status) formData.append("status", status);
      if (message) formData.append("message", message);
      if (file) formData.append("response_file", file);

      const response = await create_request(`service-requests/${requestId}/manage/`, formData);
      this.selectedRequest = response.data;
      return response.data;
    },

    async downloadRequestDocument(requestId) {
      return get_request(`service-requests/${requestId}/document/download/`, "arraybuffer");
    },

    async downloadFieldFile(requestId, fileId) {
      return get_request(
        `service-requests/${requestId}/field-files/${fileId}/download/`,
        "arraybuffer"
      );
    },

    async downloadResponseFile(requestId, responseId, fileId) {
      return get_request(
        `service-requests/${requestId}/responses/${responseId}/files/${fileId}/download/`,
        "arraybuffer"
      );
    },

    async fetchAdminServices() {
      const response = await get_request("services/admin/list/");
      this.adminServices = response.data.services || [];
      return this.adminServices;
    },

    async createService(payload, iconFile = null) {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      if (iconFile) formData.append("icon_image", iconFile);

      const response = await create_request("services/admin/create/", formData);
      return response.data;
    },

    async updateService(serviceId, payload, iconFile = null) {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      if (iconFile) formData.append("icon_image", iconFile);

      const response = await update_request(`services/admin/${serviceId}/update/`, formData);
      return response.data;
    },

    async toggleServiceActive(serviceId) {
      const response = await create_request(`services/admin/${serviceId}/toggle-active/`, {});
      return response.data;
    },

    async toggleServiceFeatured(serviceId) {
      const response = await create_request(`services/admin/${serviceId}/toggle-featured/`, {});
      return response.data;
    },
  },
});
