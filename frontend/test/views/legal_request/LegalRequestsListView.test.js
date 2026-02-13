import { mount } from "@vue/test-utils";

import LegalRequestsListView from "@/views/legal_request/LegalRequestsList.vue";

const mockRouterPush = jest.fn();
const mockUserInit = jest.fn();
const mockUserById = jest.fn();
let mockAuthStore = { userAuth: { id: 10 } };

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@/stores/auth/auth.js", () => ({
  __esModule: true,
  useAuthStore: () => mockAuthStore,
}));

jest.mock("@/stores/auth/user.js", () => ({
  __esModule: true,
  useUserStore: () => ({
    init: mockUserInit,
    userById: mockUserById,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  DocumentTextIcon: { template: "<span />" },
  PlusIcon: { template: "<span />" },
}));

const SearchBarStub = {
  name: "SearchBarAndFilterBy",
  emits: ["update:searchQuery"],
  template:
    "<div><button data-test='search' @click=\"$emit('update:searchQuery','abc')\">search</button><slot></slot><slot name='auxiliary_button' /></div>",
};

const LegalRequestsListStub = {
  name: "LegalRequestsList",
  props: ["userRole", "externalSearchQuery"],
  template:
    "<div><div data-test='props'>{{ userRole }}|{{ externalSearchQuery }}</div><button data-test='view' @click=\"$emit('view-detail', 123)\">view</button></div>",
};

const RouterLinkStub = {
  name: "RouterLink",
  template: "<a><slot /></a>",
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("views/legal_request/LegalRequestsList.vue", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockUserInit.mockResolvedValue();
    mockUserById.mockReset();
    mockAuthStore = { userAuth: { id: 10 } };
  });

  test("loads user role, updates search query, and routes to detail", async () => {
    mockUserById.mockReturnValue({ id: 10, role: "client" });

    const wrapper = mount(LegalRequestsListView, {
      global: {
        stubs: {
          SearchBarAndFilterBy: SearchBarStub,
          LegalRequestsList: LegalRequestsListStub,
          RouterLink: RouterLinkStub,
        },
      },
    });

    await flushPromises();

    expect(mockUserInit).toHaveBeenCalled();
    expect(wrapper.find("[data-test='props']").text()).toContain("client|");
    expect(wrapper.text()).toContain("Nueva Solicitud");

    await wrapper.find("[data-test='search']").trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-test='props']").text()).toContain("|abc");

    await wrapper.find("[data-test='view']").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "legal_request_detail",
      params: { id: 123 },
    });
  });
});
