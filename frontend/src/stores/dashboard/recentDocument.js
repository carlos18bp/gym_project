import { defineStore } from 'pinia';
import { create_request, get_request } from '@/stores/services/request_http';

export const useRecentDocumentStore = defineStore('recentDocument', {
  state: () => ({
    recentDocuments: [],
  }),

  actions: {
    async fetchRecentDocuments() {
      try {
        const response = await get_request('dynamic-documents/recent/');
        this.recentDocuments = response.data;
      } catch (error) {
        console.error('Error fetching recent documents:', error);
      }
    },

    async updateRecentDocument(documentId) {
      try {
        await create_request(`dynamic-documents/${documentId}/update-recent/`, 'POST');
        await this.fetchRecentDocuments(); // Refresh the list
      } catch (error) {
        console.error('Error updating recent document:', error);
      }
    },
  },
}); 