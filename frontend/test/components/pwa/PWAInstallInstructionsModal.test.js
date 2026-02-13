import { mount } from "@vue/test-utils";

import PWAInstallInstructionsModal from "@/components/pwa/PWAInstallInstructionsModal.vue";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
  ArrowDownTrayIcon: { template: "<span />" },
}));

const TransitionStub = {
  template: "<div><slot /></div>",
};

const DialogStub = {
  template: "<div><slot /></div>",
};

describe("PWAInstallInstructionsModal.vue", () => {
  test("renders browser instructions and emits close", async () => {
    const wrapper = mount(PWAInstallInstructionsModal, {
      props: {
        isOpen: true,
        browser: "edge",
      },
      global: {
        stubs: {
          Dialog: DialogStub,
          DialogPanel: DialogStub,
          DialogTitle: DialogStub,
          TransitionRoot: TransitionStub,
          TransitionChild: TransitionStub,
        },
      },
    });

    expect(wrapper.text()).toContain("Microsoft Edge");

    const closeBtn = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Entendido"));

    await closeBtn.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
