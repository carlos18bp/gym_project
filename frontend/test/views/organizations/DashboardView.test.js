import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useUserStore } from "@/stores/auth/user";

import OrganizationsDashboardView from "@/views/organizations/Dashboard.vue";

const CorporateClientDashboardStub = {
  name: "CorporateClientDashboard",
  template: "<div data-test='corporate-dashboard' />",
};

const ClientOrganizationsViewStub = {
  name: "ClientOrganizationsView",
  template: "<div data-test='client-dashboard' />",
};

const RequestDetailViewStub = {
  name: "RequestDetailView",
  template: "<div data-test='request-detail' />",
};

describe("views/organizations/Dashboard.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("renders RequestDetailView when route query tab=request-detail", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const wrapper = mount(OrganizationsDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          CorporateClientDashboard: CorporateClientDashboardStub,
          ClientOrganizationsView: ClientOrganizationsViewStub,
          RequestDetailView: RequestDetailViewStub,
        },
        mocks: {
          $route: {
            query: { tab: "request-detail", id: "6001" },
          },
        },
      },
    });

    expect(wrapper.find("[data-test='request-detail']").exists()).toBe(true);
    expect(wrapper.find("[data-test='client-dashboard']").exists()).toBe(false);
    expect(wrapper.find("[data-test='corporate-dashboard']").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Acceso Restringido");
  });

  test("renders corporate dashboard for corporate_client role", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const wrapper = mount(OrganizationsDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          CorporateClientDashboard: CorporateClientDashboardStub,
          ClientOrganizationsView: ClientOrganizationsViewStub,
          RequestDetailView: RequestDetailViewStub,
        },
        mocks: {
          $route: { query: {} },
        },
      },
    });

    expect(wrapper.find("[data-test='corporate-dashboard']").exists()).toBe(true);
    expect(wrapper.find("[data-test='client-dashboard']").exists()).toBe(false);
    expect(wrapper.find("[data-test='request-detail']").exists()).toBe(false);
  });

  test("renders client view for client/basic role", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "basic" } });

    const wrapper = mount(OrganizationsDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          CorporateClientDashboard: CorporateClientDashboardStub,
          ClientOrganizationsView: ClientOrganizationsViewStub,
          RequestDetailView: RequestDetailViewStub,
        },
        mocks: {
          $route: { query: {} },
        },
      },
    });

    expect(wrapper.find("[data-test='client-dashboard']").exists()).toBe(true);
    expect(wrapper.find("[data-test='corporate-dashboard']").exists()).toBe(false);
    expect(wrapper.find("[data-test='request-detail']").exists()).toBe(false);
  });

  test("renders access denied for unsupported roles", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "lawyer" } });

    const wrapper = mount(OrganizationsDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          CorporateClientDashboard: CorporateClientDashboardStub,
          ClientOrganizationsView: ClientOrganizationsViewStub,
          RequestDetailView: RequestDetailViewStub,
        },
        mocks: {
          $route: { query: {} },
        },
      },
    });

    expect(wrapper.text()).toContain("Acceso Restringido");
    expect(wrapper.text()).toContain("No tienes permisos");
  });

  test("renders access denied when current user has no role", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1 } });

    const wrapper = mount(OrganizationsDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          CorporateClientDashboard: CorporateClientDashboardStub,
          ClientOrganizationsView: ClientOrganizationsViewStub,
          RequestDetailView: RequestDetailViewStub,
        },
        mocks: {
          $route: { query: {} },
        },
      },
    });

    expect(wrapper.text()).toContain("Acceso Restringido");
    expect(wrapper.find("[data-test='client-dashboard']").exists()).toBe(false);
    expect(wrapper.find("[data-test='corporate-dashboard']").exists()).toBe(false);
  });

  test("renders access denied when current user is null", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: null });

    const wrapper = mount(OrganizationsDashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          CorporateClientDashboard: CorporateClientDashboardStub,
          ClientOrganizationsView: ClientOrganizationsViewStub,
          RequestDetailView: RequestDetailViewStub,
        },
        mocks: {
          $route: { query: {} },
        },
      },
    });

    expect(wrapper.text()).toContain("Acceso Restringido");
    expect(wrapper.find("[data-test='client-dashboard']").exists()).toBe(false);
    expect(wrapper.find("[data-test='corporate-dashboard']").exists()).toBe(false);
  });
});
