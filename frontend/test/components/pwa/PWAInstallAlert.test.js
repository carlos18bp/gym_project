import { mount } from "@vue/test-utils";

import PWAInstallAlert from "@/components/pwa/PWAInstallAlert.vue";

const mockPromptInstall = jest.fn();

jest.mock("@/composables/usePWAInstall", () => {
  const { ref } = require("vue");

  return {
    __esModule: true,
    usePWAInstall: () => ({
      isAppInstalled: ref(false),
      promptInstall: mockPromptInstall,
    }),
  };
});

jest.mock("@heroicons/vue/20/solid", () => ({
  __esModule: true,
  InformationCircleIcon: { template: "<span />" },
}));

jest.mock("gsap", () => ({
  __esModule: true,
  default: {
    to: jest.fn(),
  },
}));

describe("PWAInstallAlert.vue", () => {
  test("clicking install triggers promptInstall", async () => {
    const wrapper = mount(PWAInstallAlert);

    const button = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Instalar aplicación"));

    expect(button).toBeTruthy();
    await button.trigger("click");

    expect(mockPromptInstall).toHaveBeenCalled();
  });
});
