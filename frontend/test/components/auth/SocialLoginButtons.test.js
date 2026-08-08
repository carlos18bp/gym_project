import { mount } from "@vue/test-utils";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons.vue";

const OUTLOOK_BUTTON = '[data-testid="outlook-login-button"]';

// GoogleLogin is registered globally by the vue3-google-login plugin in main.js
const mountButtons = (props = {}) =>
  mount(SocialLoginButtons, {
    props,
    global: { stubs: { GoogleLogin: true } },
  });

describe("components/auth/SocialLoginButtons", () => {
  test("keeps the Microsoft button clickable when no popup is running", () => {
    const wrapper = mountButtons({ outlookLoading: false });

    expect(wrapper.find(OUTLOOK_BUTTON).attributes("disabled")).toBeUndefined();
  });

  test("disables the Microsoft button while its popup is in flight", () => {
    const wrapper = mountButtons({ outlookLoading: true });

    expect(wrapper.find(OUTLOOK_BUTTON).attributes("disabled")).toBeDefined();
  });

  test("labels the Microsoft button as connecting while its popup is in flight", () => {
    const wrapper = mountButtons({ outlookLoading: true });

    expect(wrapper.find(OUTLOOK_BUTTON).text()).toContain("Conectando");
  });

  test("emits outlook when the Microsoft button is clicked", async () => {
    const wrapper = mountButtons();

    await wrapper.find(OUTLOOK_BUTTON).trigger("click");

    expect(wrapper.emitted("outlook")).toHaveLength(1);
  });

  test("renders the divider only when requested", () => {
    const wrapper = mountButtons({ showDivider: true });

    expect(wrapper.text()).toContain("O continuar con");
  });
});
