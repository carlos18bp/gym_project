import { mount } from "@vue/test-utils";

import ResponseMessage from "@/components/legal-requests/ResponseMessage.vue";

jest.mock("@heroicons/vue/24/solid", () => ({
  __esModule: true,
  UserIcon: { template: "<span />" },
  ScaleIcon: { template: "<span />" },
}));

describe("ResponseMessage.vue", () => {
  test("renders lawyer current user styles", () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const response = {
      user_name: "Ana",
      user_type: "lawyer",
      response_text: "Respuesta",
      created_at: now.toISOString(),
    };

    const wrapper = mount(ResponseMessage, {
      props: {
        response,
        isCurrentUser: true,
      },
    });

    const expectedTime = now.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    expect(wrapper.text()).toContain("Abogado");
    expect(wrapper.text()).toContain(expectedTime);
    expect(wrapper.find(".flex-row-reverse").exists()).toBe(true);
    expect(wrapper.find(".bg-indigo-100").exists()).toBe(true);
    expect(wrapper.find(".bg-indigo-600").exists()).toBe(true);

    jest.useRealTimers();
  });

  test("renders client message with gray styles", () => {
    const response = {
      user_name: "Luis",
      user_type: "client",
      response_text: "Hola",
      created_at: "2026-02-08T12:00:00.000Z",
    };

    const wrapper = mount(ResponseMessage, {
      props: {
        response,
        isCurrentUser: false,
      },
    });

    expect(wrapper.text()).toContain("Cliente");
    expect(wrapper.find(".flex-row-reverse").exists()).toBe(false);
    expect(wrapper.find(".bg-gray-100").exists()).toBe(true);
  });
});
