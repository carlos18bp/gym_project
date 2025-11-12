import { computed } from 'vue';
import { useUserStore } from '@/stores/auth/user';
import { showNotification } from '@/shared/notification_message';

/**
 * Composable to handle restrictions for basic users
 * Basic users can see features but cannot use them
 */
export function useBasicUserRestrictions() {
  const userStore = useUserStore();
  
  /**
   * Check if current user is a basic user
   */
  const isBasicUser = computed(() => {
    return userStore.currentUser?.role === 'basic';
  });
  
  /**
   * Show restriction notification for basic users
   * @param {string} featureName - Name of the restricted feature
   */
  const showRestrictionNotification = (featureName) => {
    showNotification(
      `Esta funcionalidad está restringida para usuarios básicos. Por favor, contacta a tu abogado para obtener acceso completo.`,
      'warning'
    );
  };
  
  /**
   * Handle feature access attempt for basic users
   * @param {string} featureName - Name of the feature being accessed
   * @param {Function} callback - Function to execute if user is not basic
   * @returns {boolean} - True if access is allowed, false if restricted
   */
  const handleFeatureAccess = (featureName, callback) => {
    if (isBasicUser.value) {
      showRestrictionNotification(featureName);
      return false;
    }
    
    if (callback) {
      callback();
    }
    return true;
  };
  
  /**
   * Get button classes for restricted features
   * @param {boolean} isDisabled - Whether button should be disabled
   * @returns {string} - CSS classes for the button
   */
  const getRestrictedButtonClasses = (isDisabled) => {
    if (!isDisabled) return '';
    
    return 'opacity-60 cursor-not-allowed';
  };
  
  return {
    isBasicUser,
    showRestrictionNotification,
    handleFeatureAccess,
    getRestrictedButtonClasses
  };
}

