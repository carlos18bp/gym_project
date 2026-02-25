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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("routes authenticated users to checkout", async () => {
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(true);

    const wrapper = shallowMount(Subscriptions, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const planButtons = wrapper
      .findAll("button")
      .filter((button) => button.text().includes("Elegir plan"));
    await planButtons[1].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
  });

  test("routes anonymous users to subscription sign in", async () => {
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    const wrapper = shallowMount(Subscriptions, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const planButtons = wrapper
      .findAll("button")
      .filter((button) => button.text().includes("Elegir plan"));
    await planButtons[0].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "subscription_sign_in",
      query: { plan: "basico" },
    });
  });
});
