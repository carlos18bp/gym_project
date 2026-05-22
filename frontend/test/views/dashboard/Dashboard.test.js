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

  test("loads the recent-process count for the welcome card on mount", async () => {
    const { wrapper } = await mountView();

    await nextTick();

    expect(mockRecentProcessStore.init).toHaveBeenCalled();
    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    expect(wrapper.vm.$.setupState.activeProcesses).toBe(2);
    expect(wrapper.vm.$.setupState.currentUser.first_name).toBe("Ana");
  });

  test("does not load recent processes without an authenticated user", async () => {
    await mountView({ authUser: {} });

    await nextTick();

    expect(mockRecentProcessStore.init).not.toHaveBeenCalled();
  });
});
