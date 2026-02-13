import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import Subscriptions from "@/views/subscriptions/Subscriptions.vue";
import { useAuthStore } from "@/stores/auth/auth";

const mockRouterPush = jest.fn();

let mockRoute;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => mockRoute,
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

let pinia;

describe("Subscriptions view", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    mockRoute = { params: {}, query: {} };
  });

  test("routes authenticated users to checkout", async () => {
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(true);

    const wrapper = shallowMount(Subscriptions, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.selectPlan("cliente");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
  });

  test("routes anonymous users to subscription sign in", async () => {
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(Subscriptions, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.selectPlan("basico");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "subscription_sign_in",
      query: { plan: "basico" },
    });
  });
});
