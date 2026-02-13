import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import InviteMemberModal from "@/components/organizations/modals/InviteMemberModal.vue";

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
    UserPlusIcon: IconStub,
    InformationCircleIcon: IconStub,
    CheckCircleIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

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

const buildOrganization = (overrides = {}) => {
  return {
    id: 1,
    title: "Acme Corp",
    member_count: 2,
    profile_image_url: "",
    ...overrides,
  };
};

describe("InviteMemberModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("opening the modal resets form and sets default message when organization becomes available", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InviteMemberModal, {
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

    await flushPromises();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    await wrapper.setProps({ organization: buildOrganization({ title: "Org X" }) });
    await flushPromises();

    expect(wrapper.find("input#email").element.value).toBe("");
    expect(wrapper.find("textarea#message").element.value).toContain('"Org X"');
  });

  test("successful submit calls store, shows success state, notifies, and emits invited", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    const sendSpy = jest.spyOn(organizationsStore, "sendInvitation").mockResolvedValue({
      invitation: { id: 77, status: "PENDING" },
    });

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 5, title: "Acme" }),
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

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();

    await wrapper.find("input#email").setValue("  client@example.com ");
    await wrapper.find("textarea#message").setValue("  Hola  ");
    await flushPromises();

    expect(submitBtn.attributes("disabled")).toBeUndefined();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(sendSpy).toHaveBeenCalledWith(5, {
      invited_user_email: "client@example.com",
      message: "Hola",
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Invitación enviada exitosamente",
      "success"
    );

    expect(wrapper.emitted("invited")).toBeTruthy();
    expect(wrapper.emitted("invited")[0]).toEqual([{ id: 77, status: "PENDING" }]);

    expect(wrapper.text()).toContain("¡Invitación Enviada!");
  });

  test("error response with details sets field errors", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "sendInvitation").mockRejectedValue({
      response: {
        data: {
          details: {
            invited_user_email: ["Email inválido"],
          },
        },
      },
    });

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 9 }),
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

    await wrapper.find("input#email").setValue("bad");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Email inválido");
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("error response with response.data.error shows error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "sendInvitation").mockRejectedValue({
      response: {
        data: {
          error: "Custom error",
        },
      },
    });

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 9 }),
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

    await wrapper.find("input#email").setValue("client@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Custom error", "error");
  });

  test("status 400 with invited_user_email sets field error", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "sendInvitation").mockRejectedValue({
      response: {
        status: 400,
        data: {
          invited_user_email: ["Email 400"],
        },
      },
    });

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 9 }),
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

    await wrapper.find("input#email").setValue("client@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Email 400");
  });

  test("status 400 without invited_user_email shows generic data error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "sendInvitation").mockRejectedValue({
      response: {
        status: 400,
        data: {},
      },
    });

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 9 }),
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

    await wrapper.find("input#email").setValue("client@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error en los datos de la invitación",
      "error"
    );
  });

  test("clicking cancel emits close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
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

    await flushPromises();

    const cancelBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Cancelar"));

    expect(cancelBtn).toBeTruthy();

    await cancelBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("clicking 'Invitar a Otra Persona' after success resets form and keeps modal open", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "sendInvitation").mockResolvedValue({
      invitation: { id: 99, status: "PENDING" },
    });

    const wrapper = mount(InviteMemberModal, {
      props: {
        visible: true,
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

    await flushPromises();

    await wrapper.find("input#email").setValue("test@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("¡Invitación Enviada!");

    const inviteAnotherBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Invitar a Otra Persona"));

    expect(inviteAnotherBtn).toBeTruthy();

    await inviteAnotherBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("input#email").element.value).toBe("");
    expect(wrapper.text()).not.toContain("¡Invitación Enviada!");
    expect(wrapper.emitted("close")).toBeFalsy();
  });
});
