import { mount } from "@vue/test-utils";

import ResponseThread from "@/components/legal-requests/ResponseThread.vue";

jest.mock("@/stores/auth/auth.js", () => ({
  __esModule: true,
  useAuthStore: () => ({ user: { id: 5 } }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  ChatBubbleLeftRightIcon: { template: "<span />" },
}));

const ResponseFormStub = {
  name: "ResponseForm",
  props: ["requestId", "userRole"],
  template: "<button data-test='add-response' @click=\"$emit('response-added', { id: 1 })\">add</button>",
};

const ResponseMessageStub = {
  name: "ResponseMessage",
  props: ["response", "isCurrentUser"],
  template: "<div data-test='response' :data-current='isCurrentUser'>{{ response.response_text }}</div>",
};

describe("ResponseThread.vue", () => {
  test("shows empty state text for lawyer", () => {
    const wrapper = mount(ResponseThread, {
      props: {
        requestId: 1,
        responses: [],
        userRole: "lawyer",
      },
      global: {
        stubs: {
          ResponseForm: ResponseFormStub,
        },
      },
    });

    expect(wrapper.text()).toContain("Sé el primero en responder");
  });

  test("emits response-added and marks current user responses", async () => {
    const wrapper = mount(ResponseThread, {
      props: {
        requestId: 1,
        responses: [{ id: 5, response_text: "Hola", user: 5 }],
        userRole: "client",
      },
      global: {
        stubs: {
          ResponseForm: ResponseFormStub,
          ResponseMessage: ResponseMessageStub,
        },
      },
    });

    expect(wrapper.find("[data-test='response']").attributes("data-current")).toBe("true");

    await wrapper.find("[data-test='add-response']").trigger("click");

    expect(wrapper.emitted("response-added")).toBeTruthy();
    expect(wrapper.emitted("response-added")[0]).toEqual([{ id: 1 }]);
  });
});
