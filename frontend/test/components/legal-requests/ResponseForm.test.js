import { mount } from "@vue/test-utils";

import ResponseForm from "@/components/legal-requests/ResponseForm.vue";

const mockCreateResponse = jest.fn();
let mockStore;

jest.mock("@/stores/legal/legal_requests_management.js", () => ({
  __esModule: true,
  useLegalRequestsStore: () => mockStore,
}));

jest.mock("@heroicons/vue/24/solid", () => ({
  __esModule: true,
  UserIcon: { template: "<span />" },
  ScaleIcon: { template: "<span />" },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ResponseForm.vue", () => {
  beforeEach(() => {
    mockCreateResponse.mockReset();
    mockStore = { createResponse: mockCreateResponse };
  });

  test("submits trimmed response and emits response-added", async () => {
    const response = { id: 1, response_text: "Hola" };
    mockCreateResponse.mockResolvedValue(response);

    const wrapper = mount(ResponseForm, {
      props: {
        requestId: 10,
        userRole: "client",
      },
    });

    await wrapper.find("textarea").setValue("  Hola  ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockCreateResponse).toHaveBeenCalledWith(10, "Hola");
    expect(wrapper.emitted("response-added")).toBeTruthy();
    expect(wrapper.emitted("response-added")[0]).toEqual([response]);
    expect(wrapper.find("textarea").element.value).toBe("");
  });

  test("shows lawyer placeholder and avatar styles", () => {
    const wrapper = mount(ResponseForm, {
      props: {
        requestId: 20,
        userRole: "lawyer",
      },
    });

    const textarea = wrapper.find("textarea");
    expect(textarea.attributes("placeholder")).toContain("respuesta profesional");
    expect(wrapper.find(".bg-indigo-100").exists()).toBe(true);
  });
});
