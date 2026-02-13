import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";
import { useCorporateRequestsStore } from "@/stores/corporate_requests";
import { useUserStore } from "@/stores/auth/user";

import ClientDashboard from "@/components/organizations/client/ClientDashboard.vue";

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    EnvelopeIcon: IconStub,
    BuildingOfficeIcon: IconStub,
    ClipboardDocumentListIcon: IconStub,
    PlusIcon: IconStub,
    ChevronDownIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const OrganizationsSectionStub = {
  name: "OrganizationsSection",
  template: "<div data-test='organizations-section' />",
};

const MyRequestsSectionStub = {
  name: "MyRequestsSection",
  template: "<div data-test='my-requests-section' />",
};

const InvitationsSectionStub = {
  name: "InvitationsSection",
  template: "<div data-test='invitations-section' />",
};

const CreateRequestModalStub = {
  name: "CreateRequestModal",
  props: ["visible"],
  template: "<div v-if='visible' data-test='create-request-modal' />",
};

const OrganizationPostsSectionStub = {
  name: "OrganizationPostsSection",
  template: "<div />",
};

describe("ClientDashboard.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("renders restricted access view for non client/basic roles", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({
      currentUser: {
        id: 1,
        role: "lawyer",
      },
    });

    const invSpy = jest
      .spyOn(organizationsStore, "getMyInvitations")
      .mockResolvedValue({});
    const memSpy = jest
      .spyOn(organizationsStore, "getMyMemberships")
      .mockResolvedValue({});
    const reqSpy = jest
      .spyOn(requestsStore, "getMyRequests")
      .mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Acceso Restringido");
    expect(wrapper.text()).toContain("Tu rol actual: lawyer");

    expect(invSpy).not.toHaveBeenCalled();
    expect(memSpy).not.toHaveBeenCalled();
    expect(reqSpy).not.toHaveBeenCalled();
  });

  test("currentTabLabel falls back to 'Selecciona sección' when activeTab is unknown", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    wrapper.vm.activeTab = "unknown";
    await flushPromises();

    expect(wrapper.vm.currentTabLabel).toBe("Selecciona sección");
  });

  test("loadData returns early when user role is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1 } });

    const invSpy = jest
      .spyOn(organizationsStore, "getMyInvitations")
      .mockResolvedValue({});
    const memSpy = jest
      .spyOn(organizationsStore, "getMyMemberships")
      .mockResolvedValue({});
    const reqSpy = jest
      .spyOn(requestsStore, "getMyRequests")
      .mockResolvedValue({ results: [] });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    await wrapper.vm.loadData();
    await flushPromises();

    expect(invSpy).not.toHaveBeenCalled();
    expect(memSpy).not.toHaveBeenCalled();
    expect(reqSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("invitation-responded refreshes invitations and memberships", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    organizationsStore.$patch({ myMemberships: [{ id: 1, title: "Acme", description: "" }] });

    const invSpy = jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    const memSpy = jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    wrapper.vm.activeTab = "invitations";
    await flushPromises();

    const invitationsSection = wrapper.findComponent({ name: "InvitationsSection" });
    expect(invitationsSection.exists()).toBe(true);

    invitationsSection.vm.$emit("invitation-responded", { id: 123 });
    await flushPromises();

    expect(invSpy).toHaveBeenCalled();
    expect(memSpy).toHaveBeenCalled();
  });

  test("organization-left refreshes memberships", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    organizationsStore.$patch({ myMemberships: [{ id: 1, title: "Acme", description: "" }] });

    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    const memSpy = jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    const organizationsSection = wrapper.findComponent({ name: "OrganizationsSection" });
    expect(organizationsSection.exists()).toBe(true);

    organizationsSection.vm.$emit("organization-left", 1);
    await flushPromises();

    expect(memSpy).toHaveBeenCalled();
  });

  test("loadData returns early when user role is not client/basic", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "lawyer" } });

    const invSpy = jest
      .spyOn(organizationsStore, "getMyInvitations")
      .mockResolvedValue({});
    const memSpy = jest
      .spyOn(organizationsStore, "getMyMemberships")
      .mockResolvedValue({});
    const reqSpy = jest
      .spyOn(requestsStore, "getMyRequests")
      .mockResolvedValue({ results: [] });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    await wrapper.vm.loadData();
    await flushPromises();

    expect(invSpy).not.toHaveBeenCalled();
    expect(memSpy).not.toHaveBeenCalled();
    expect(reqSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("switches from 'Mis Solicitudes' to 'Mis Organizaciones' when memberships become empty", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({
      currentUser: {
        id: 1,
        role: "client",
      },
    });

    organizationsStore.$patch({
      myMemberships: [{ id: 1, title: "Acme", description: "" }],
      myInvitations: [],
    });

    requestsStore.$patch({ myRequests: [] });

    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    const requestsTabButton = wrapper
      .find('nav[aria-label="Tabs"]')
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Mis Solicitudes"));

    expect(requestsTabButton).toBeTruthy();
    expect(requestsTabButton.attributes("disabled")).toBeUndefined();

    await requestsTabButton.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='my-requests-section']").exists()).toBe(true);

    organizationsStore.$patch({ myMemberships: [] });
    await flushPromises();

    expect(wrapper.find("[data-test='organizations-section']").exists()).toBe(true);
    expect(wrapper.find("[data-test='my-requests-section']").exists()).toBe(false);

    const requestsTabButtonAfter = wrapper
      .find('nav[aria-label="Tabs"]')
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Mis Solicitudes"));

    expect(requestsTabButtonAfter).toBeTruthy();
    expect(requestsTabButtonAfter.attributes("disabled")).toBeDefined();
  });

  test("emitting request-detail navigates to request detail route query", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({
      currentUser: {
        id: 1,
        role: "client",
      },
    });

    organizationsStore.$patch({
      myMemberships: [{ id: 1, title: "Acme", description: "" }],
      myInvitations: [],
    });

    requestsStore.$patch({ myRequests: [{ id: 123, request_number: "CORP-REQ-123" }] });

    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    const requestsTabButton = wrapper
      .find('nav[aria-label="Tabs"]')
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Mis Solicitudes"));

    await requestsTabButton.trigger("click");
    await flushPromises();

    const myRequestsSection = wrapper.findComponent({ name: "MyRequestsSection" });
    expect(myRequestsSection.exists()).toBe(true);

    myRequestsSection.vm.$emit("request-detail", 123);
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "organizations_dashboard",
      query: { tab: "request-detail", id: 123 },
    });
  });

  test("emitting created from CreateRequestModal refreshes requests and switches to requests tab", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({
      currentUser: {
        id: 1,
        role: "client",
      },
    });

    organizationsStore.$patch({
      myMemberships: [{ id: 1, title: "Acme", description: "" }],
      myInvitations: [],
    });

    requestsStore.$patch({ myRequests: [] });

    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});

    const getMyRequestsSpy = jest
      .spyOn(requestsStore, "getMyRequests")
      .mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    const createRequestButton = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Nueva Solicitud"));

    expect(createRequestButton).toBeTruthy();
    await createRequestButton.trigger("click");
    await flushPromises();

    const modal = wrapper.findComponent({ name: "CreateRequestModal" });
    expect(modal.exists()).toBe(true);

    modal.vm.$emit("created", { id: 999 });
    await flushPromises();

    expect(getMyRequestsSpy).toHaveBeenCalled();
    expect(wrapper.find("[data-test='my-requests-section']").exists()).toBe(true);
  });

  test("loadData logs skip message when requests load is rejected with 403", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    organizationsStore.$patch({ myMemberships: [{ id: 1, title: "Acme", description: "" }] });

    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});

    jest.spyOn(requestsStore, "getMyRequests").mockRejectedValue({
      response: { status: 403 },
    });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "User may not have organization memberships yet, skipping request load",
    );

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("loadData catch logs access denied message when an action throws 403", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    jest.spyOn(organizationsStore, "getMyInvitations").mockImplementation(() => {
      throw { response: { status: 403 } };
    });
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    await wrapper.vm.loadData();
    await flushPromises();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Access denied. User may not have proper permissions.",
    );

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("onMounted calls userStore.init when currentUser is not available", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: null });

    const initSpy = jest.spyOn(userStore, "init").mockImplementation(async () => {
      userStore.$patch({ currentUser: { id: 1, role: "client" } });
    });

    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    expect(initSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("handleViewOrganizationDetails scrolls and highlights the referenced element", async () => {
    jest.useFakeTimers();

    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    jest.spyOn(organizationsStore, "getMyInvitations").mockResolvedValue({});
    jest.spyOn(organizationsStore, "getMyMemberships").mockResolvedValue({});
    jest.spyOn(requestsStore, "getMyRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(ClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          OrganizationsSection: OrganizationsSectionStub,
          MyRequestsSection: MyRequestsSectionStub,
          InvitationsSection: InvitationsSectionStub,
          CreateRequestModal: CreateRequestModalStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    const flushPromise = flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromise;

    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({ top: 200 });

    const scrollSpy = jest.spyOn(window, "scrollTo").mockImplementation(() => {});

    wrapper.vm.setOrganizationRef(el, 123);
    wrapper.vm.handleViewOrganizationDetails(123);

    expect(scrollSpy).toHaveBeenCalledWith({
      top: 50,
      behavior: "smooth",
    });
    expect(el.classList.contains("ring-2")).toBe(true);

    jest.advanceTimersByTime(2000);
    expect(el.classList.contains("ring-2")).toBe(false);

    scrollSpy.mockRestore();
    jest.useRealTimers();
  });
});
