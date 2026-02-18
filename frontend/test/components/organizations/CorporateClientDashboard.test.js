import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";
import { useCorporateRequestsStore } from "@/stores/corporate_requests";
import { useUserStore } from "@/stores/auth/user";

import CorporateClientDashboard from "@/components/organizations/corporate_client/CorporateClientDashboard.vue";

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
    BuildingOfficeIcon: IconStub,
    UsersIcon: IconStub,
    EnvelopeIcon: IconStub,
    ClipboardDocumentListIcon: IconStub,
    PencilIcon: IconStub,
    UserPlusIcon: IconStub,
    CalendarIcon: IconStub,
    ChatBubbleLeftIcon: IconStub,
    PlusIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const CreateOrganizationModalStub = {
  name: "CreateOrganizationModal",
  props: ["visible"],
  template: "<div data-test='create-org-modal' />",
};

const EditOrganizationModalStub = {
  name: "EditOrganizationModal",
  props: ["visible", "organization"],
  template: "<div data-test='edit-org-modal' />",
};

const InviteMemberModalStub = {
  name: "InviteMemberModal",
  props: ["visible", "organization"],
  template: "<div data-test='invite-member-modal' />",
};

const MembersListModalStub = {
  name: "MembersListModal",
  props: ["visible", "organization"],
  template: "<div data-test='members-list-modal' />",
};

const AllMembersModalStub = {
  name: "AllMembersModal",
  props: ["visible", "organizations"],
  template: "<div data-test='all-members-modal' />",
};

const OrganizationPostsSectionStub = {
  name: "OrganizationPostsSection",
  template: "<div data-test='org-posts-section' />",
};

const ReceivedRequestsSectionStub = {
  name: "ReceivedRequestsSection",
  template: `
    <div data-test='received-requests-section'>
      <button type='button' data-test='emit-view-detail' @click="$emit('view-detail', 6001)">view</button>
      <button type='button' data-test='emit-status-updated' @click="$emit('status-updated', { requestId: 6001, newStatus: 'RESOLVED' })">status</button>
      <button type='button' data-test='emit-refresh' @click="$emit('refresh')">refresh</button>
    </div>
  `,
};

const dashboardStubs = {
  CreateOrganizationModal: CreateOrganizationModalStub,
  EditOrganizationModal: EditOrganizationModalStub,
  InviteMemberModal: InviteMemberModalStub,
  MembersListModal: MembersListModalStub,
  AllMembersModal: AllMembersModalStub,
  ReceivedRequestsSection: ReceivedRequestsSectionStub,
  OrganizationPostsSection: OrganizationPostsSectionStub,
};

const mountCorporateDashboard = async ({ currentUser, organizations = [] } = {}) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const userStore = useUserStore();
  userStore.$patch({ currentUser: currentUser || { id: 1, role: "corporate_client" } });

  const organizationsStore = useOrganizationsStore();
  const requestsStore = useCorporateRequestsStore();

  const orgsSpy = jest
    .spyOn(organizationsStore, "getMyOrganizations")
    .mockResolvedValue({ results: [] });
  const statsSpy = jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
  const receivedSpy = jest
    .spyOn(requestsStore, "getReceivedRequests")
    .mockResolvedValue({ results: [] });

  const wrapper = mount(CorporateClientDashboard, {
    global: {
      plugins: [pinia],
      stubs: dashboardStubs,
    },
  });

  await flushPromises();

  if (organizations.length) {
    organizationsStore.$patch({ organizations });
    await wrapper.vm.$nextTick();
  }

  return { wrapper, orgsSpy, statsSpy, receivedSpy, organizationsStore, requestsStore, userStore };
};

const findButtonByText = (wrapper, matcher) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => {
      const text = (b.text() || "").trim();
      return typeof matcher === "string" ? text.includes(matcher) : matcher(text);
    });
  if (!btn) {
    throw new Error("Button not found");
  }
  return btn;
};

describe("CorporateClientDashboard.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("onMounted (corporate_client) loads organizations, stats, and received requests", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    const orgsSpy = jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    const statsSpy = jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    const receivedSpy = jest
      .spyOn(requestsStore, "getReceivedRequests")
      .mockResolvedValue({ results: [] });

    mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    expect(orgsSpy).toHaveBeenCalled();
    expect(statsSpy).toHaveBeenCalled();
    expect(receivedSpy).toHaveBeenCalledWith({ page_size: 50 });
  });

  test("view request detail emits router push with query tab=request-detail", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    jest.spyOn(requestsStore, "getReceivedRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='emit-view-detail']").trigger("click");
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "organizations_dashboard",
      query: { tab: "request-detail", id: 6001 },
    });
  });

  test("status-updated handler calls updateReceivedRequest and refreshes received requests", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});

    const receivedSpy = jest
      .spyOn(requestsStore, "getReceivedRequests")
      .mockResolvedValue({ results: [] });

    const updateSpy = jest
      .spyOn(requestsStore, "updateReceivedRequest")
      .mockResolvedValue({});

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    receivedSpy.mockClear();

    await wrapper.find("[data-test='emit-status-updated']").trigger("click");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith(6001, { status: "RESOLVED" });
    expect(receivedSpy).toHaveBeenCalledWith({ page_size: 50 });
  });

  test("refresh event triggers getReceivedRequests", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});

    const receivedSpy = jest
      .spyOn(requestsStore, "getReceivedRequests")
      .mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    receivedSpy.mockClear();

    await wrapper.find("[data-test='emit-refresh']").trigger("click");
    await flushPromises();

    expect(receivedSpy).toHaveBeenCalledWith({ page_size: 50 });
  });

  test("non corporate role shows access restricted state", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Acceso Restringido");
    expect(wrapper.text()).toContain("solo para clientes corporativos");
  });

  test("onMounted initializes user when currentUser is missing and then loads data", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: null });

    const initSpy = jest.spyOn(userStore, "init").mockImplementation(async () => {
      userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });
    });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    const orgsSpy = jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    const statsSpy = jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    const receivedSpy = jest.spyOn(requestsStore, "getReceivedRequests").mockResolvedValue({ results: [] });

    mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    expect(initSpy).toHaveBeenCalled();
    expect(orgsSpy).toHaveBeenCalled();
    expect(statsSpy).toHaveBeenCalled();
    expect(receivedSpy).toHaveBeenCalledWith({ page_size: 50 });
  });

  test("loadData returns early and logs when user role is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1 } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    const orgsSpy = jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    const statsSpy = jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    const receivedSpy = jest.spyOn(requestsStore, "getReceivedRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    orgsSpy.mockClear();
    statsSpy.mockClear();
    receivedSpy.mockClear();
    console.error.mockClear();

    await wrapper.vm.$.setupState.loadData();

    expect(console.error).toHaveBeenCalledWith("User role not available");
    expect(orgsSpy).not.toHaveBeenCalled();
    expect(statsSpy).not.toHaveBeenCalled();
    expect(receivedSpy).not.toHaveBeenCalled();
  });

  test("loadData returns early and logs when user is not corporate_client", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    const orgsSpy = jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    const statsSpy = jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    const receivedSpy = jest.spyOn(requestsStore, "getReceivedRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    orgsSpy.mockClear();
    statsSpy.mockClear();
    receivedSpy.mockClear();
    console.error.mockClear();

    await wrapper.vm.$.setupState.loadData();

    expect(console.error).toHaveBeenCalledWith(
      "User is not a corporate client, cannot load corporate dashboard data"
    );
    expect(orgsSpy).not.toHaveBeenCalled();
    expect(statsSpy).not.toHaveBeenCalled();
    expect(receivedSpy).not.toHaveBeenCalled();
  });

  test("loadData logs friendly error for 403 response", async () => {
    const { wrapper, orgsSpy } = await mountCorporateDashboard();

    console.error.mockClear();

    orgsSpy.mockRejectedValueOnce({ response: { status: 403 } });
    await wrapper.vm.$.setupState.loadData();

    expect(console.error).toHaveBeenCalledWith(
      "Error loading dashboard data:",
      expect.objectContaining({ response: expect.objectContaining({ status: 403 }) })
    );
    expect(console.error).toHaveBeenCalledWith(
      "Access denied. User may not have corporate client permissions."
    );
  });

  test("loadData logs friendly error for 401 response", async () => {
    const { wrapper, orgsSpy } = await mountCorporateDashboard();

    console.error.mockClear();

    orgsSpy.mockRejectedValueOnce({ response: { status: 401 } });
    await wrapper.vm.$.setupState.loadData();

    expect(console.error).toHaveBeenCalledWith(
      "Error loading dashboard data:",
      expect.objectContaining({ response: expect.objectContaining({ status: 401 }) })
    );
    expect(console.error).toHaveBeenCalledWith(
      "Authentication error. User may need to log in again."
    );
  });

  test("all members modal opens and closes", async () => {
    const { wrapper } = await mountCorporateDashboard();

    const allMembersButton = wrapper.find("button[title='Ver todos los miembros de tus organizaciones']");
    if (!allMembersButton.exists()) {
      throw new Error("All members button not found");
    }

    await allMembersButton.trigger("click");
    expect(wrapper.findComponent(AllMembersModalStub).props("visible")).toBe(true);

    wrapper.findComponent({ name: "AllMembersModal" }).vm.$emit("close");
    await flushPromises();

    expect(wrapper.findComponent(AllMembersModalStub).props("visible")).toBe(false);
  });

  test("create organization modal toggles and created refreshes lists", async () => {
    const { wrapper, orgsSpy, statsSpy } = await mountCorporateDashboard();

    const createButton = findButtonByText(wrapper, "Crear Organización");
    await createButton.trigger("click");

    expect(wrapper.findComponent(CreateOrganizationModalStub).props("visible")).toBe(true);

    wrapper.findComponent({ name: "CreateOrganizationModal" }).vm.$emit("close");
    await flushPromises();

    expect(wrapper.findComponent(CreateOrganizationModalStub).props("visible")).toBe(false);

    orgsSpy.mockClear();
    statsSpy.mockClear();
    wrapper.findComponent({ name: "CreateOrganizationModal" }).vm.$emit("created", { id: 2 });
    await flushPromises();

    expect([orgsSpy.mock.calls.length, statsSpy.mock.calls.length]).toEqual([1, 1]);
  });

  test("edit organization modal opens and updated refreshes organizations", async () => {
    const { wrapper, orgsSpy } = await mountCorporateDashboard({
      organizations: [
        {
          id: 1,
          title: "Org",
          description: "Desc",
          created_at: "2024-01-01T00:00:00Z",
          member_count: 1,
          pending_invitations_count: 0,
          profile_image_url: null,
          cover_image_url: null,
        },
      ],
    });

    orgsSpy.mockClear();

    const editButton = findButtonByText(wrapper, "Editar");
    await editButton.trigger("click");

    expect(wrapper.findComponent(EditOrganizationModalStub).props("visible")).toBe(true);

    wrapper.findComponent({ name: "EditOrganizationModal" }).vm.$emit("updated", { id: 1 });
    await flushPromises();

    expect(orgsSpy).toHaveBeenCalled();
  });

  test("invite member modal opens and invited refreshes stats", async () => {
    const { wrapper, statsSpy } = await mountCorporateDashboard({
      organizations: [
        {
          id: 1,
          title: "Org",
          description: "Desc",
          created_at: "2024-01-01T00:00:00Z",
          member_count: 1,
          pending_invitations_count: 0,
          profile_image_url: null,
          cover_image_url: null,
        },
      ],
    });

    statsSpy.mockClear();

    const inviteButton = findButtonByText(wrapper, "Invitar Miembro");
    await inviteButton.trigger("click");

    expect(wrapper.findComponent(InviteMemberModalStub).props("visible")).toBe(true);

    wrapper.findComponent({ name: "InviteMemberModal" }).vm.$emit("invited", { ok: true });
    await flushPromises();

    expect(statsSpy).toHaveBeenCalled();
  });

  test("members list modal opens and closes", async () => {
    const { wrapper } = await mountCorporateDashboard({
      organizations: [
        {
          id: 1,
          title: "Org",
          description: "Desc",
          created_at: "2024-01-01T00:00:00Z",
          member_count: 1,
          pending_invitations_count: 0,
          profile_image_url: null,
          cover_image_url: null,
        },
      ],
    });

    const membersButton = wrapper.find("button[title='Ver lista de miembros de Org']");
    if (!membersButton.exists()) {
      throw new Error("Members button not found");
    }

    await membersButton.trigger("click");
    expect(wrapper.findComponent(MembersListModalStub).props("visible")).toBe(true);

    wrapper.findComponent({ name: "MembersListModal" }).vm.$emit("close");
    await flushPromises();

    expect(wrapper.findComponent(MembersListModalStub).props("visible")).toBe(false);
  });

  test("status-updated handler logs error when updateReceivedRequest fails", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    jest.spyOn(requestsStore, "getReceivedRequests").mockResolvedValue({ results: [] });

    jest
      .spyOn(requestsStore, "updateReceivedRequest")
      .mockRejectedValueOnce(new Error("fail"));

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    await flushPromises();

    console.error.mockClear();

    await wrapper.find("[data-test='emit-status-updated']").trigger("click");
    await flushPromises();

    expect(console.error).toHaveBeenCalledWith(
      "Error updating request status:",
      expect.any(Error)
    );
  });

  test("formatRelativeDate handles day/week/month branches", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const organizationsStore = useOrganizationsStore();
    const requestsStore = useCorporateRequestsStore();

    jest.spyOn(organizationsStore, "getMyOrganizations").mockResolvedValue({ results: [] });
    jest.spyOn(organizationsStore, "getOrganizationStats").mockResolvedValue({});
    jest.spyOn(requestsStore, "getReceivedRequests").mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateClientDashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          CreateOrganizationModal: CreateOrganizationModalStub,
          EditOrganizationModal: EditOrganizationModalStub,
          InviteMemberModal: InviteMemberModalStub,
          MembersListModal: MembersListModalStub,
          AllMembersModal: AllMembersModalStub,
          ReceivedRequestsSection: ReceivedRequestsSectionStub,
          OrganizationPostsSection: OrganizationPostsSectionStub,
        },
      },
    });

    const { formatRelativeDate } = wrapper.vm.$.setupState;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const isoAgo = (days) => new Date(now - (days - 0.5) * dayMs).toISOString();

    expect(formatRelativeDate(isoAgo(1))).toBe("Hace 1 día");
    expect(formatRelativeDate(isoAgo(3))).toBe("Hace 3 días");
    expect(formatRelativeDate(isoAgo(10))).toBe("Hace 2 semanas");
  });
});
