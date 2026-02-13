import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

import DashboardView from "@/views/dashboard/dashboard.vue";
import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";

let mockRecentProcessStore;

jest.mock("@/stores/dashboard/recentProcess", () => ({
  __esModule: true,
  useRecentProcessStore: () => mockRecentProcessStore,
}));

jest.mock("@/components/dashboard/LegalUpdatesCard.vue", () => ({
  __esModule: true,
  default: { template: "<div />" },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const mountView = async ({
  user = { id: 1, first_name: "Ana", last_name: "Lopez" },
  authUser = { id: 1 },
  recentProcesses = [{ id: 1 }, { id: 2 }],
  recentInitReject = false,
} = {}) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const userStore = useUserStore();
  const authStore = useAuthStore();

  userStore.$patch({ users: user ? [user] : [] });
  authStore.$patch({ userAuth: authUser });

  jest.spyOn(userStore, "init").mockResolvedValue();

  mockRecentProcessStore = {
    recentProcesses,
    init: recentInitReject ? jest.fn().mockRejectedValue(new Error("fail")) : jest.fn().mockResolvedValue(),
  };

  const wrapper = shallowMount(DashboardView, {
    global: {
      plugins: [pinia],
      stubs: {
        UserWelcomeCard: { template: "<div />" },
        ActivityFeed: { template: "<div />" },
        LegalUpdatesCard: { template: "<div />" },
        QuickActionButtons: { template: "<div />" },
        RecentProcessList: { template: "<div />" },
        RecentDocumentsList: { template: "<div />" },
      },
    },
  });

  await flushPromises();

  return { wrapper, userStore, authStore };
};

describe("Dashboard view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads recent processes and reveals secondary sections", async () => {
    jest.useFakeTimers();

    const { wrapper } = await mountView();

    await nextTick();
    jest.advanceTimersByTime(200);
    await nextTick();

    expect(mockRecentProcessStore.init).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.activeProcesses).toBe(2);
    expect(wrapper.vm.$.setupState.showRecentProcesses).toBe(true);
    expect(wrapper.vm.$.setupState.showRecentDocuments).toBe(true);
    expect(wrapper.vm.$.setupState.currentUser.first_name).toBe("Ana");

    jest.useRealTimers();
  });

  test("does not load secondary sections without authenticated user", async () => {
    jest.useFakeTimers();

    const { wrapper } = await mountView({ authUser: {} });

    await nextTick();
    jest.advanceTimersByTime(300);
    await nextTick();

    expect(mockRecentProcessStore.init).not.toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.showRecentProcesses).toBe(false);
    expect(wrapper.vm.$.setupState.showRecentDocuments).toBe(false);

    jest.useRealTimers();
  });
});
