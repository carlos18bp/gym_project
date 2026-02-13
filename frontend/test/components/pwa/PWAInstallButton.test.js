import { mount } from "@vue/test-utils";

import PWAInstallButton from "@/components/pwa/PWAInstallButton.vue";

const mockPromptInstall = jest.fn();
const mockCloseInstructions = jest.fn();

jest.mock("@/composables/usePWAInstall", () => {
  const { ref } = require("vue");

  return {
    __esModule: true,
    usePWAInstall: () => ({
      isAppInstalled: ref(false),
      showInstructionsModal: ref(true),
      currentBrowser: ref("chrome"),
      promptInstall: mockPromptInstall,
      closeInstructionsModal: mockCloseInstructions,
    }),
  };
});

jest.mock("@heroicons/vue/20/solid", () => ({
  __esModule: true,
  ArrowDownTrayIcon: { template: "<span />" },
  SparklesIcon: { template: "<span />" },
}));

const PWAInstallInstructionsModalStub = {
  props: ["isOpen", "browser"],
  template: "<div data-test='instructions' />",
};

describe("PWAInstallButton.vue", () => {
  test("renders install CTA and modal", async () => {
    const wrapper = mount(PWAInstallButton, {
      global: {
        stubs: {
          PWAInstallInstructionsModal: PWAInstallInstructionsModalStub,
        },
      },
    });

    expect(wrapper.text()).toContain("Instalar Aplicación");
    expect(wrapper.find("[data-test='instructions']").exists()).toBe(true);

    await wrapper.find("a").trigger("click");
    expect(mockPromptInstall).toHaveBeenCalled();
  });
});
