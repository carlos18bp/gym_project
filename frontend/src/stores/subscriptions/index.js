import { defineStore } from "pinia";
import { get_request, create_request, patch_request } from "../services/request_http";
import { useAuthStore } from "../auth/auth";

export const useSubscriptionStore = defineStore("subscription", {
  state: () => ({
    currentSubscription: null,
    subscriptionHistory: [],
    isLoading: false,
    wompiPublicKey: null,
  }),

  getters: {
    hasActiveSubscription: (state) => {
      return state.currentSubscription?.status === 'active';
    },

    isFreePlan: (state) => {
      return state.currentSubscription?.plan_type === 'basico';
    },

    isPaidPlan: (state) => {
      return ['cliente', 'corporativo'].includes(state.currentSubscription?.plan_type);
    },

    nextBillingDate: (state) => {
      return state.currentSubscription?.next_billing_date;
    },
  },

  actions: {
    /**
     * Get current user's subscription
     * @returns {Promise<object>} Current subscription data
     */
    async fetchCurrentSubscription() {
      this.isLoading = true;
      try {
        const response = await get_request('subscriptions/current/');
        this.currentSubscription = response.data;
        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          this.currentSubscription = null;
        } else {
          console.error('Error fetching subscription:', error);
          throw error;
        }
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Get subscription history
     * @returns {Promise<array>} Subscription history
     */
    async fetchSubscriptionHistory() {
      this.isLoading = true;
      try {
        const response = await get_request('subscriptions/history/');
        this.subscriptionHistory = response.data;
        return response.data;
      } catch (error) {
        console.error('Error fetching subscription history:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Generate Wompi integrity signature
     * @param {object} params - { amount_in_cents, currency, reference }
     * @returns {Promise<string>} Integrity signature
     */
    async generateWompiSignature(params) {
      try {
        const response = await create_request('subscriptions/generate-signature/', params);
        return response.data.signature;
      } catch (error) {
        console.error('Error generating Wompi signature:', error);
        throw error;
      }
    },

    /**
     * Get Wompi public key from backend
     * @returns {Promise<string>} Wompi public key
     */
    async fetchWompiPublicKey() {
      try {
        const response = await get_request('subscriptions/wompi-config/');
        this.wompiPublicKey = response.data.public_key;
        return response.data.public_key;
      } catch (error) {
        console.error('Error fetching Wompi config:', error);
        throw error;
      }
    },

    /**
     * Create a new subscription
     * @param {object} params - { plan_type, payment_source_id }
     * @returns {Promise<object>} Created subscription
     */
    async createSubscription(params) {
      this.isLoading = true;
      try {
        const response = await create_request('subscriptions/create/', params);
        this.currentSubscription = response.data;
        return response.data;
      } catch (error) {
        console.error('Error creating subscription:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Cancel current subscription
     * @returns {Promise<object>} Updated subscription
     */
    async cancelSubscription() {
      this.isLoading = true;
      try {
        const response = await patch_request('subscriptions/cancel/', {});
        this.currentSubscription = response.data;
        return response.data;
      } catch (error) {
        console.error('Error cancelling subscription:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Reactivate a cancelled subscription
     * @returns {Promise<object>} Updated subscription
     */
    async reactivateSubscription() {
      this.isLoading = true;
      try {
        const response = await patch_request('subscriptions/reactivate/', {});
        this.currentSubscription = response.data;
        return response.data;
      } catch (error) {
        console.error('Error reactivating subscription:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update payment method
     * @param {string} paymentSourceId - New Wompi payment source ID
     * @returns {Promise<object>} Updated subscription
     */
    async updatePaymentMethod(paymentSourceId) {
      this.isLoading = true;
      try {
        const response = await patch_request('subscriptions/update-payment-method/', {
          payment_source_id: paymentSourceId
        });
        this.currentSubscription = response.data;
        return response.data;
      } catch (error) {
        console.error('Error updating payment method:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Get payment history
     * @returns {Promise<array>} Payment history
     */
    async fetchPaymentHistory() {
      try {
        const response = await get_request('subscriptions/payments/');
        return response.data;
      } catch (error) {
        console.error('Error fetching payment history:', error);
        throw error;
      }
    },

    /**
     * Reset store state
     */
    resetState() {
      this.currentSubscription = null;
      this.subscriptionHistory = [];
      this.isLoading = false;
      this.wompiPublicKey = null;
    },
  },
});
