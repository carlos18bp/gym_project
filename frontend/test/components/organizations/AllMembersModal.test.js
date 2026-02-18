import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import AllMembersModal from "@/components/organizations/modals/AllMembersModal.vue";

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    XMarkIcon: IconStub,
    UsersIcon: IconStub,
    CheckCircleIcon: IconStub,
    CalendarIcon: IconStub,
  };
});

const TransitionRootStub = {
  name: "TransitionRoot",
  props: ["show"],
  template: "<div v-if='show'><slot /></div>",
};

const TransitionChildStub = {
  name: "TransitionChild",
  template: "<div><slot /></div>",
};

const DialogStub = {
  name: "Dialog",
  template: "<div><slot /></div>",
};

const DialogPanelStub = {
  name: "DialogPanel",
  template: "<div><slot /></div>",
};

const DialogTitleStub = {
  name: "DialogTitle",
  template: "<div><slot /></div>",
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildOrg = (overrides = {}) => ({
  id: 1,
  title: "Acme",
  profile_image_url: "",
  ...overrides,
});

const buildMember = (id, fullName, email) => ({
  id,
  role: "MEMBER",
  role_display: "Miembro",
  is_active: true,
  joined_at: "2026-02-01T00:00:00.000Z",
  user_info: {
    full_name: fullName,
    email,
    profile_image_url: "",
  },
});

describe("AllMembersModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  const mountVisibleModal = async (pinia, organizations) => {
    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    return wrapper;
  };

  test("when visible becomes true, loads members for each organization", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const getSpy = jest
      .spyOn(store, "getOrganizationMembers")
      .mockImplementation(async (orgId) => {
        if (orgId === 1) return [buildMember(10, "Alice Doe", "alice@example.com")];
        if (orgId === 2) return [buildMember(20, "Bob Roe", "bob@example.com")];
        return [];
      });

    await mountVisibleModal(pinia, [
      buildOrg({ id: 1, title: "Org 1" }),
      buildOrg({ id: 2, title: "Org 2" }),
    ]);

    expect(getSpy).toHaveBeenCalledWith(1);
    expect(getSpy).toHaveBeenCalledWith(2);
  });

  test("renders totals and member details when visible", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "getOrganizationMembers").mockImplementation(async (orgId) => {
      if (orgId === 1) return [buildMember(10, "Alice Doe", "alice@example.com")];
      if (orgId === 2) return [buildMember(20, "Bob Roe", "bob@example.com")];
      return [];
    });

    const wrapper = await mountVisibleModal(pinia, [
      buildOrg({ id: 1, title: "Org 1" }),
      buildOrg({ id: 2, title: "Org 2" }),
    ]);

    const text = wrapper.text();
    const expected = [
      "Todos los Miembros",
      "2 miembros",
      "2 organizaciones",
      "Org 1",
      "Org 2",
      "Alice Doe",
      "alice@example.com",
      "Bob Roe",
      "bob@example.com",
    ];

    expect(expected.every((item) => text.includes(item))).toBe(true);
  });

  test("if a single org members call fails, it still renders others and does not show global error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "getOrganizationMembers").mockImplementation(async (orgId) => {
      if (orgId === 1) throw new Error("fail");
      return [buildMember(20, "Bob Roe", "bob@example.com")];
    });

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: [buildOrg({ id: 1, title: "Org 1" }), buildOrg({ id: 2, title: "Org 2" })],
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(wrapper.text()).toContain("Org 1");
    expect(wrapper.text()).toContain("Org 2");
    expect(wrapper.text()).toContain("Bob Roe");

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("when organizations prop is empty, shows empty state and does not call store", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const getSpy = jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: [],
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(getSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("No hay miembros");
  });

  test("loadAllMembers returns early when organizations are empty", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const getSpy = jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: [],
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.vm.$.setupState.loadAllMembers();
    await flushPromises();

    expect(getSpy).not.toHaveBeenCalled();
  });

  test("loadAllMembers returns early when organizations prop is null", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const getSpy = jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: null,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.vm.$.setupState.loadAllMembers();
    await flushPromises();

    expect(getSpy).not.toHaveBeenCalled();
  });

  test("uses empty member list when store returns undefined", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const getSpy = jest
      .spyOn(store, "getOrganizationMembers")
      .mockResolvedValue(undefined);

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: [buildOrg({ id: 1, title: "Org 1" })],
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith(1);
    expect(wrapper.text()).toContain("Org 1");
    expect(wrapper.text()).toContain("0 miembros");
    expect(wrapper.text()).toContain("1 organización");
  });

  test("uses empty member list when store returns null", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const getSpy = jest
      .spyOn(store, "getOrganizationMembers")
      .mockResolvedValue(null);

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: [buildOrg({ id: 1, title: "Org 1" })],
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith(1);
    expect(wrapper.text()).toContain("0 miembros");
  });

  test("loadAllMembers handles unexpected failure and shows notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const badOrganizations = {
      length: 1,
      map: () => {
        throw new Error("boom");
      },
    };

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: false,
        organizations: badOrganizations,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await wrapper.vm.$.setupState.loadAllMembers();
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cargar los miembros",
      "error"
    );
    expect(wrapper.vm.$.setupState.organizationsWithMembers).toEqual([]);
  });

  test("close button emits close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(AllMembersModal, {
      props: {
        visible: true,
        organizations: [buildOrg({ id: 1, title: "Org" })],
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    const closeBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Cerrar"));

    expect(closeBtn).toBeTruthy();

    await closeBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
