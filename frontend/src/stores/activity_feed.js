import { defineStore } from 'pinia';
import { get_request, create_request } from './services/request_http';

// Define action types to match backend exactly
export const ACTION_TYPES = {
  CREATE: 'create',
  EDIT: 'edit',
  FINISH: 'finish',
  DELETE: 'delete',
  UPDATE: 'update',
  OTHER: 'other'
};

// Standalone utility function that can be imported by other stores
export async function registerUserActivity(actionType, description) {
  // Validate that the action type is one of the allowed types
  const validActionTypes = Object.values(ACTION_TYPES);
  if (!validActionTypes.includes(actionType)) {
    console.warn(`Invalid action type: ${actionType}. Using 'other' instead.`);
    actionType = ACTION_TYPES.OTHER;
  }

  try {
    const response = await create_request('create-activity/', {
      action_type: actionType,
      description
    });
    return response.data;
  } catch (error) {
    console.error('Error registering activity:', error);
    throw error;
  }
}

export const useActivityFeedStore = defineStore('activityFeed', {
  state: () => ({
    activities: [],
    loading: false,
    error: null
  }),

  actions: {
    async fetchUserActivities() {
      this.loading = true;
      this.error = null;
      
      try {
        console.log('Requesting user activities from API');
        const response = await get_request('user-activities/');
        console.log('Received response:', response);
        
        if (!response.data || !Array.isArray(response.data)) {
          console.error('Invalid response format:', response);
          this.error = 'Invalid response format from server';
          return;
        }
        
        this.activities = response.data.map(activity => ({
          id: activity.id,
          type: activity.action_type,
          description: activity.description,
          time: formatTimeAgo(new Date(activity.created_at))
        }));
        
        console.log('Processed activities:', this.activities.length, this.activities);
      } catch (error) {
        console.error('Error fetching activity feed:', error);
        this.error = error.response?.data?.detail || 'Error fetching activity feed';
      } finally {
        this.loading = false;
      }
    },

    async createActivity(actionType, description) {
      this.loading = true;
      this.error = null;
      
      try {
        // Use the utility function
        const activityData = await registerUserActivity(actionType, description);
        
        // Add the new activity to the beginning of the array
        const newActivity = {
          id: activityData.id,
          type: activityData.action_type,
          description: activityData.description,
          time: formatTimeAgo(new Date(activityData.created_at))
        };
        
        this.activities.unshift(newActivity);
      } catch (error) {
        this.error = error.response?.data?.detail || 'Error creating activity';
        console.error('Error creating activity:', error);
      } finally {
        this.loading = false;
      }
    },

    // Helper method that other stores can use to register an activity and update local state
    async registerActivity(actionType, description) {
      try {
        const activityData = await registerUserActivity(actionType, description);
        
        // If we already have activities loaded, update the local state
        if (this.activities.length > 0) {
          const newActivity = {
            id: activityData.id,
            type: activityData.action_type,
            description: activityData.description,
            time: formatTimeAgo(new Date(activityData.created_at))
          };
          
          this.activities.unshift(newActivity);
        }
        
        return activityData;
      } catch (error) {
        console.error('Error registering activity:', error);
        throw error;
      }
    }
  }
});

// Helper function to format time in "X ago" format
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Hace unos segundos';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `Hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `Hace ${diffInWeeks} ${diffInWeeks === 1 ? 'semana' : 'semanas'}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `Hace ${diffInMonths} ${diffInMonths === 1 ? 'mes' : 'meses'}`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `Hace ${diffInYears} ${diffInYears === 1 ? 'año' : 'años'}`;
} 