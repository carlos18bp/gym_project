import { defineStore } from "pinia";
import {
  get_request,
  create_request,
  delete_request,
} from "./services/request_http";

export const useNotificationStore = defineStore("notification", {
  state: () => ({
    notifications: [],
    unreadCount: 0,
    totalCount: 0,
    currentTab: "all",
    currentPage: 1,
    pageSize: 20,
    dataLoaded: false,
    pollingInterval: null,
  }),

  getters: {
    hasUnread: (state) => state.unreadCount > 0,
    latestNotifications: (state) => state.notifications.slice(0, 3),
  },

  actions: {
    /**
     * Fetch paginated notifications based on current tab and page.
     */
    async fetchNotifications(tab = null, page = null) {
      if (tab !== null) this.currentTab = tab;
      if (page !== null) this.currentPage = page;

      try {
        const response = await get_request(
          `notifications/?tab=${this.currentTab}&page=${this.currentPage}`
        );
        const data = response.data;
        this.notifications = data.results || [];
        this.totalCount = data.count || 0;
        this.pageSize = data.page_size || 20;
        this.dataLoaded = true;
      } catch (error) {
        console.error("Error fetching notifications:", error.message);
        this.notifications = [];
        this.totalCount = 0;
      }
    },

    /**
     * Fetch only the unread count (lightweight, used by bell badge).
     */
    async fetchUnreadCount() {
      try {
        const response = await get_request("notifications/unread-count/");
        const newCount = response.data.unread_count || 0;
        if (newCount !== this.unreadCount) {
          this.unreadCount = newCount;
        }
      } catch (error) {
        console.error("Error fetching unread count:", error.message);
      }
    },

    /**
     * Mark a single notification as read.
     */
    async markAsRead(notificationId) {
      try {
        await create_request(`notifications/${notificationId}/read/`, {});
        const notif = this.notifications.find((n) => n.id === notificationId);
        if (notif && !notif.is_read) {
          notif.is_read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
      } catch (error) {
        console.error("Error marking notification as read:", error.message);
      }
    },

    /**
     * Mark a single notification as unread (toggle back from read).
     */
    async markAsUnread(notificationId) {
      try {
        await create_request(`notifications/${notificationId}/unread/`, {});
        const notif = this.notifications.find((n) => n.id === notificationId);
        if (notif && notif.is_read) {
          notif.is_read = false;
          this.unreadCount = this.unreadCount + 1;
        }
      } catch (error) {
        console.error("Error marking notification as unread:", error.message);
      }
    },

    /**
     * Mark all notifications as read.
     */
    async markAllRead() {
      try {
        const response = await create_request(
          "notifications/mark-all-read/",
          {}
        );
        this.notifications.forEach((n) => (n.is_read = true));
        this.unreadCount = 0;
        return response.data.updated || 0;
      } catch (error) {
        console.error("Error marking all as read:", error.message);
        return 0;
      }
    },

    /**
     * Archive a notification.
     */
    async archiveNotification(notificationId) {
      try {
        await create_request(`notifications/${notificationId}/archive/`, {});
        this.notifications = this.notifications.filter(
          (n) => n.id !== notificationId
        );
        this.totalCount = Math.max(0, this.totalCount - 1);
        await this.fetchUnreadCount();
      } catch (error) {
        console.error("Error archiving notification:", error.message);
      }
    },

    /**
     * Restore an archived notification back to the active list.
     */
    async unarchiveNotification(notificationId) {
      try {
        await create_request(
          `notifications/${notificationId}/unarchive/`,
          {}
        );
        // Remove from current view (the archived tab) — it now lives in "all".
        this.notifications = this.notifications.filter(
          (n) => n.id !== notificationId
        );
        this.totalCount = Math.max(0, this.totalCount - 1);
        await this.fetchUnreadCount();
      } catch (error) {
        console.error("Error unarchiving notification:", error.message);
      }
    },

    /**
     * Snooze a notification for a predefined duration.
     * @param {number} notificationId
     * @param {string} duration - '1h', '3h', '1d', '3d'
     */
    async snoozeNotification(notificationId, duration) {
      try {
        await create_request(`notifications/${notificationId}/snooze/`, {
          duration,
        });
        this.notifications = this.notifications.filter(
          (n) => n.id !== notificationId
        );
        this.totalCount = Math.max(0, this.totalCount - 1);
        await this.fetchUnreadCount();
      } catch (error) {
        console.error("Error snoozing notification:", error.message);
      }
    },

    /**
     * Soft-delete a notification.
     */
    async deleteNotification(notificationId) {
      try {
        await delete_request(`notifications/${notificationId}/delete/`);
        this.notifications = this.notifications.filter(
          (n) => n.id !== notificationId
        );
        this.totalCount = Math.max(0, this.totalCount - 1);
        await this.fetchUnreadCount();
      } catch (error) {
        console.error("Error deleting notification:", error.message);
      }
    },

    /**
     * Start polling unread count every 60 seconds.
     */
    startPolling() {
      this.stopPolling();
      this.fetchUnreadCount();
      this.pollingInterval = setInterval(() => {
        this.fetchUnreadCount();
      }, 60000);
    },

    /**
     * Stop the polling interval.
     */
    stopPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    },

    /**
     * Navigate to the resource referenced by a notification's link_type.
     * Falls back to the notification center when the link is missing or unknown.
     */
    navigateToNotificationTarget(router, notif) {
      if (!notif.link_id) {
        router.push({ name: "notifications" });
        return;
      }
      if (notif.link_type === "process") {
        router.push({
          name: "process_detail",
          params: { process_id: notif.link_id },
          query: { highlight: notif.link_id },
        });
        return;
      }
      if (notif.link_type === "document") {
        router.push({
          name: "dynamic_document_dashboard",
          query: { highlight: notif.link_id },
        });
        return;
      }
      if (notif.link_type === "service_request") {
        router.push({
          name: "service_request_detail",
          params: { id: notif.link_id },
          query: { highlight: notif.link_id },
        });
        return;
      }
      router.push({ name: "notifications" });
    },
  },
});
