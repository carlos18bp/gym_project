import { mount } from "@vue/test-utils";

import LegalRequestDetailView from "@/views/legal_request/LegalRequestDetail.vue";

const mockRouterGo = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    go: mockRouterGo,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  ArrowLeftIcon: { template: "<span />" },
}));

const LegalRequestDetailStub = {
  name: "LegalRequestDetail",
  props: ["userRole"],
  template: "<div data-test='detail'>{{ userRole }}</div>",
};

describe("views/legal_request/LegalRequestDetail.vue", () => {
  beforeEach(() => {
    mockRouterGo.mockReset();
  });

  test("passes userRole to detail component and handles back action", async () => {
    const wrapper = mount(LegalRequestDetailView, {
      props: {
        userRole: "lawyer",
      },
      global: {
        stubs: {
          LegalRequestDetail: LegalRequestDetailStub,
        },
      },
    });

    expect(wrapper.find("[data-test='detail']").text()).toContain("lawyer");

    const backButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Regresar"));

    expect(backButton).toBeTruthy();
    await backButton.trigger("click");

    expect(mockRouterGo).toHaveBeenCalledWith(-1);
  });
});
