import {
  get_request,
  create_request,
  update_request,
  delete_request,
} from "../services/request_http";
import { registerUserActivity, ACTION_TYPES } from "../dashboard/activity_feed";

/**
 * Tag management actions
 */
export const tagActions = {
  /**
   * Fetch all tags from the server
   * @param {boolean} forceRefresh - Whether to bypass cache
   * @returns {Promise<Array>} List of tags
   */
  async fetchTags(forceRefresh = false) {
    // Prevent multiple simultaneous requests
    if (this.isLoadingTags) return this.tags;
    
    // Return cached tags if available and not forcing refresh
    if (this.tagsLoaded && !forceRefresh) {
      return this.tags;
    }
    
    this.isLoadingTags = true;
    
    try {
      const response = await get_request('dynamic-documents/tags/');
      this.tags = response.data || [];
      this.tagsLoaded = true;
      
      return this.tags;
    } catch (error) {
      console.error("Error fetching tags:", error);
      this.tags = [];
      throw error;
    } finally {
      this.isLoadingTags = false;
    }
  },

  /**
   * Create a new tag
   * @param {Object} tagData - Tag data (name, color_id)
   * @returns {Promise<Object>} Created tag
   */
  async createTag(tagData) {
    try {
      const response = await create_request('dynamic-documents/tags/create/', tagData);
      
      // Add to local tags list
      this.tags.push(response.data);
      
      // Register user activity
      await registerUserActivity(
        ACTION_TYPES.CREATE,
        `Creaste la etiqueta "${tagData.name}"`
      );
      
      return response.data;
    } catch (error) {
      console.error("Error creating tag:", error);
      throw error;
    }
  },

  /**
   * Update an existing tag
   * @param {number|string} tagId - ID of the tag to update
   * @param {Object} tagData - Updated tag data
   * @returns {Promise<Object>} Updated tag
   */
  async updateTag(tagId, tagData) {
    try {
      const response = await update_request(`dynamic-documents/tags/${tagId}/update/`, tagData);
      
      // Update in local tags list
      const tagIndex = this.tags.findIndex(tag => tag.id == tagId);
      if (tagIndex >= 0) {
        this.tags[tagIndex] = response.data;
      }
      
      // Register user activity
      await registerUserActivity(
        ACTION_TYPES.UPDATE,
        `Actualizaste la etiqueta "${tagData.name || 'sin nombre'}"`
      );
      
      return response.data;
    } catch (error) {
      console.error(`Error updating tag ID ${tagId}:`, error);
      throw error;
    }
  },

  /**
   * Delete a tag
   * @param {number|string} tagId - ID of the tag to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteTag(tagId) {
    try {
      // Get tag name before deletion for activity log
      let tagName = "etiqueta";
      const existingTag = this.tagById(tagId);
      if (existingTag) {
        tagName = existingTag.name;
      }
      
      const response = await delete_request(`dynamic-documents/tags/${tagId}/delete/`);
      
      if (response.status === 204) {
        // Remove from local tags list
        this.tags = this.tags.filter(tag => tag.id != tagId);
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.DELETE,
          `Eliminaste la etiqueta "${tagName}"`
        );
        
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting tag ID ${tagId}:`, error);
      return false;
    }
  },

  /**
   * Initialize tags data
   * @param {boolean} forceRefresh - Whether to force refresh
   */
  async initTags(forceRefresh = false) {
    if (!this.tagsLoaded || forceRefresh) {
      await this.fetchTags(forceRefresh);
    }
  },
};