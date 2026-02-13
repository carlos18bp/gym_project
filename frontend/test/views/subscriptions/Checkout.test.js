import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import Checkout from "@/views/subscriptions/Checkout.vue";
import { useUserStore } from "@/stores/auth/user";
import { useSubscriptionStore } from "@/stores/subscriptions";

const mockRouterPush = jest.fn();

let mockRoute;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => mockRoute,
}));

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: jest.fn(),
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const ensureWompiScripts = () => {
  const widgetScript = document.createElement("script");
  widgetScript.id = "wompi-widget-script";
  document.head.appendChild(widgetScript);

  const jsScript = document.createElement("script");
  jsScript.id = "wompi-js-script";
  document.head.appendChild(jsScript);
};

const clearWompiScripts = () => {
  ["wompi-widget-script", "wompi-js-script"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.remove();
  });
};

const mountView = async ({
  plan = "basico",
  subscriptionOverrides = {},
  user = { first_name: "Ana", last_name: "Lopez", email: "ana@test.com" },
} = {}) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const userStore = useUserStore();
  const subscriptionStore = useSubscriptionStore();

  userStore.$patch({ currentUser: user });
  jest.spyOn(userStore, "init").mockResolvedValue();

  jest.spyOn(subscriptionStore, "fetchWompiPublicKey").mockResolvedValue("pk_test");
  jest.spyOn(subscriptionStore, "createSubscription").mockResolvedValue();
  Object.assign(subscriptionStore, subscriptionOverrides);

  mockRoute = { params: { plan }, query: {} };

  const wrapper = shallowMount(Checkout, {
    global: {
      plugins: [pinia],
    },
  });

  await flushPromises();

  return { wrapper, subscriptionStore };
};

describe("Checkout view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearWompiScripts();
    delete window.$wompi;
  });

  test("goBack routes to subscriptions", async () => {
    const { wrapper } = await mountView();

    wrapper.vm.$.setupState.goBack();

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "subscriptions" });
  });

  test("creates free plan subscription and navigates", async () => {
    const { wrapper, subscriptionStore } = await mountView({ plan: "basico" });

    await wrapper.vm.$.setupState.handleSubscribe();

    expect(subscriptionStore.createSubscription).toHaveBeenCalledWith({ plan_type: "basico" });
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "dashboard" });
  });

  test("shows error when free plan activation fails", async () => {
    const { wrapper, subscriptionStore } = await mountView({
      plan: "basico",
      subscriptionOverrides: {
        createSubscription: jest.fn().mockRejectedValue(new Error("fail")),
      },
    });

    await wrapper.vm.$.setupState.handleSubscribe();

    expect(subscriptionStore.createSubscription).toHaveBeenCalled();
  });

  test("validates card info before tokenizing", async () => {
    ensureWompiScripts();
    const { wrapper } = await mountView({ plan: "cliente" });

    await wrapper.vm.$.setupState.tokenizeCard();

    const Swal = await import("sweetalert2");
    expect(Swal.default.fire).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Información incompleta" })
    );
  });

  test("tokenizes card and stores token", async () => {
    ensureWompiScripts();
    const axios = await import("axios");
    axios.post.mockResolvedValue({ data: { status: "CREATED", data: { id: "tok_1" } } });

    const { wrapper } = await mountView({ plan: "cliente" });

    wrapper.vm.$.setupState.cardNumber = "4242 4242 4242 4242";
    wrapper.vm.$.setupState.cardExpMonth = "12";
    wrapper.vm.$.setupState.cardExpYear = "28";
    wrapper.vm.$.setupState.cardCvc = "123";
    wrapper.vm.$.setupState.cardHolder = "Ana Lopez";
    wrapper.vm.$.setupState.wompiPublicKey = "pk_test";

    await wrapper.vm.$.setupState.tokenizeCard();

    expect(axios.post).toHaveBeenCalledWith(
      "https://sandbox.wompi.co/v1/tokens/cards",
      expect.objectContaining({
        number: "4242424242424242",
        cvc: "123",
        exp_month: "12",
        exp_year: "28",
        card_holder: "Ana Lopez",
      }),
      expect.any(Object)
    );
    expect(wrapper.vm.$.setupState.cardToken).toBe("tok_1");
  });

  test("requires payment token for paid plan", async () => {
    ensureWompiScripts();
    const { wrapper } = await mountView({ plan: "cliente" });

    await wrapper.vm.$.setupState.handleSubscribe();

    const Swal = await import("sweetalert2");
    expect(Swal.default.fire).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Método de pago requerido" })
    );
  });

  test("creates paid subscription when data is complete", async () => {
    ensureWompiScripts();
    const { wrapper, subscriptionStore } = await mountView({ plan: "cliente" });

    wrapper.vm.$.setupState.cardToken = "tok_1";
    wrapper.vm.$.setupState.wompiSessionId = "sess_1";

    await wrapper.vm.$.setupState.handleSubscribe();

    expect(subscriptionStore.createSubscription).toHaveBeenCalledWith({
      plan_type: "cliente",
      session_id: "sess_1",
      token: "tok_1",
    });
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "dashboard" });
  });
});
