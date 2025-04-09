import { create_request } from "@/stores/services/request_http";

/**
 * Composable for handling recent views of different resource types
 * @returns {Object} Object containing functions to manage recent views
 */
export function useRecentViews() {
  /**
   * Register a view for a specific resource
   * @param {string} resourceType - Type of resource ('process', 'document', etc.)
   * @param {number|string} resourceId - ID of the viewed resource
   * @returns {Promise<void>}
   */
  const registerView = async (resourceType, resourceId) => {
    if (!resourceId) return;

    const endpoints = {
      process: `update-recent-process/${resourceId}/`,
      document: `dynamic-documents/${resourceId}/update-recent/`,
      // Add more resource types here as needed
    };

    const endpoint = endpoints[resourceType];
    if (!endpoint) {
      console.warn(`No endpoint configured for resource type: ${resourceType}`);
      return;
    }

    try {
      await create_request(endpoint, 'POST');
    } catch (error) {
      console.error(`Error registering ${resourceType} view:`, error);
    }
  };

  return {
    registerView,
  };
} 