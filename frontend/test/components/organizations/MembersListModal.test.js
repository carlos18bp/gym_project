import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import MembersListModal from "@/components/organizations/modals/MembersListModal.vue";

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

const buildOrganization = (overrides = {}) => ({
  id: 1,
  title: "Acme",
  profile_image_url: "",
  ...overrides,
});

describe("MembersListModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("when visible becomes true, loads members for organization", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const members = [
      {
        id: 10,
        role: "ADMIN",
        role_display: "Admin",
        is_active: true,
        joined_at: "2026-02-01T00:00:00.000Z",
        user_info: {
          full_name: "Alice Doe",
          first_name: "Alice",
          last_name: "Doe",
          email: "alice@example.com",
          profile_image_url: "",
        },
      },
    ];

    const spy = jest.spyOn(store, "getOrganizationMembers").mockResolvedValue(members);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: buildOrganization({ id: 99, title: "Org 99" }),
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

    expect(spy).toHaveBeenCalledWith(99);
    expect(wrapper.text()).toContain("Miembros de Org 99");
    expect(wrapper.text()).toContain("Alice Doe");
    expect(wrapper.text()).toContain("alice@example.com");
    expect(wrapper.text()).toContain("Activo");
  });

  test("on load error, shows notification and displays empty state", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "getOrganizationMembers").mockRejectedValue(new Error("fail"));

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: buildOrganization({ id: 1, title: "Org" }),
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

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cargar los miembros",
      "error"
    );

    expect(wrapper.text()).toContain("No hay miembros");
  });

  test("close button emits close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 1, title: "Org" }),
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

  test("skips loading when organization lacks id", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const spy = jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: buildOrganization({ id: null, title: "Org" }),
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

    expect(spy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("No hay miembros");
  });

  test("loadMembers returns early when organization is null", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const spy = jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([]);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: null,
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

    await wrapper.vm.$.setupState.loadMembers();

    expect(spy).not.toHaveBeenCalled();
  });

  test("uses empty list when store returns undefined", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const spy = jest
      .spyOn(store, "getOrganizationMembers")
      .mockResolvedValue(undefined);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: buildOrganization({ id: 21, title: "Org" }),
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

    expect(spy).toHaveBeenCalledWith(21);
    expect(wrapper.text()).toContain("No hay miembros");
  });

  test("shows initials fallback when member names are missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "getOrganizationMembers").mockResolvedValue([
      {
        id: 1,
        role: "ADMIN",
        role_display: "Admin",
        is_active: false,
        joined_at: "2026-02-01T00:00:00.000Z",
        user_info: {
          full_name: "Sin Nombre",
          email: "sin-nombre@example.com",
          profile_image_url: "",
        },
      },
    ]);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: buildOrganization({ id: 5, title: "Org" }),
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

    expect(wrapper.find("li").text()).toContain("?");
  });

  test("getInitials returns initials when names exist", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(MembersListModal, {
      props: {
        visible: false,
        organization: buildOrganization({ id: 1 }),
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

    const { getInitials } = wrapper.vm.$.setupState;

    expect(getInitials("Ana", "Diaz")).toBe("AD");
    expect(getInitials("Ana", null)).toBe("A");
  });
});
