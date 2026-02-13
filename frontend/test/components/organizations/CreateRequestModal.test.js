import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useCorporateRequestsStore } from "@/stores/corporate_requests";

import CreateRequestModal from "@/components/organizations/modals/CreateRequestModal.vue";

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
    InformationCircleIcon: IconStub,
    CheckCircleIcon: IconStub,
    PaperAirplaneIcon: IconStub,
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

const buildOrganizations = () => [
  {
    id: 1,
    title: "Acme Corp",
    description: "Desc",
    profile_image_url: "",
    corporate_client_info: {
      full_name: "Corp Owner",
    },
  },
];

describe("CreateRequestModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("loadRequestTypes: invalid format shows notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue({ not: "an-array" });

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Formato de tipos de solicitud inválido",
      "error"
    );
  });

  test("loadRequestTypes: 403 shows permissions notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockRejectedValue({
      response: { status: 403 },
    });

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    expect(mockShowNotification).toHaveBeenCalledWith(
      "No tienes permisos para cargar tipos de solicitudes",
      "error"
    );
  });

  test("loadRequestTypes: 401 shows session expired notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockRejectedValue({
      response: { status: 401 },
    });

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Sesión expirada. Por favor, vuelve a iniciar sesión",
      "error"
    );
  });

  test("loadRequestTypes: generic error shows fallback notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockRejectedValue({
      response: { status: 500 },
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mount(CreateRequestModal, {
      props: {
        visible: true,
        organizations: buildOrganizations(),
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

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cargar tipos de solicitudes",
      "error"
    );

    consoleSpy.mockRestore();
  });

  test("disables submit until form is valid", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    const submitButton = wrapper.find('button[type="submit"]');
    expect(submitButton.exists()).toBe(true);
    expect(submitButton.attributes("disabled")).toBeDefined();

    await wrapper.find("select#organization").setValue("1");
    await wrapper.find("select#request_type").setValue("1");
    await wrapper.find("input#title").setValue("Título");
    await wrapper.find("textarea#description").setValue("Descripción");

    await flushPromises();

    expect(submitButton.attributes("disabled")).toBeUndefined();
  });

  test("successful submit shows success state, emits created, and notifies", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);

    const createSpy = jest
      .spyOn(requestsStore, "createCorporateRequest")
      .mockResolvedValue({
        corporate_request: {
          id: 500,
          request_number: "CORP-REQ-500",
          organization_info: { title: "Acme Corp" },
        },
      });

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    await wrapper.find("select#organization").setValue("1");
    await wrapper.find("select#request_type").setValue("1");
    await wrapper.find("input#title").setValue("  Título  ");
    await wrapper.find("textarea#description").setValue("  Descripción  ");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({
      organization: 1,
      request_type: 1,
      title: "Título",
      description: "Descripción",
      priority: "MEDIUM",
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Solicitud enviada exitosamente",
      "success"
    );

    expect(wrapper.emitted("created")).toBeTruthy();
    expect(wrapper.emitted("created")[0][0].request_number).toBe("CORP-REQ-500");

    expect(wrapper.text()).toContain("¡Solicitud Enviada!");
    expect(wrapper.text()).toContain("CORP-REQ-500");
  });

  test("error submit sets field errors from response.data.details", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);

    jest.spyOn(requestsStore, "createCorporateRequest").mockRejectedValue({
      response: {
        data: {
          details: {
            title: ["Title is invalid"],
          },
        },
      },
    });

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    await wrapper.find("select#organization").setValue("1");
    await wrapper.find("select#request_type").setValue("1");
    await wrapper.find("input#title").setValue("Título");
    await wrapper.find("textarea#description").setValue("Descripción");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Title is invalid");
  });

  test("error submit shows response.data.error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);
    jest.spyOn(requestsStore, "createCorporateRequest").mockRejectedValue({
      response: { data: { error: "Backend says no" } },
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: true,
        organizations: buildOrganizations(),
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

    await wrapper.find("select#organization").setValue("1");
    await wrapper.find("select#request_type").setValue("1");
    await wrapper.find("input#title").setValue("Título");
    await wrapper.find("textarea#description").setValue("Descripción");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Backend says no", "error");

    consoleSpy.mockRestore();
  });

  test("error submit shows generic notification when response has no details/error", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);
    jest.spyOn(requestsStore, "createCorporateRequest").mockRejectedValue(new Error("fail"));

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: true,
        organizations: buildOrganizations(),
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

    await wrapper.find("select#organization").setValue("1");
    await wrapper.find("select#request_type").setValue("1");
    await wrapper.find("input#title").setValue("Título");
    await wrapper.find("textarea#description").setValue("Descripción");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al enviar la solicitud",
      "error"
    );

    consoleSpy.mockRestore();
  });

  test("success state: 'Crear Otra Solicitud' resets view back to form", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);
    jest.spyOn(requestsStore, "createCorporateRequest").mockResolvedValue({
      corporate_request: {
        id: 500,
        request_number: "CORP-REQ-500",
        organization_info: { title: "Acme Corp" },
      },
    });

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: true,
        organizations: buildOrganizations(),
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

    await wrapper.find("select#organization").setValue("1");
    await wrapper.find("select#request_type").setValue("1");
    await wrapper.find("input#title").setValue("Título");
    await wrapper.find("textarea#description").setValue("Descripción");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("¡Solicitud Enviada!");

    const createAnotherButton = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Crear Otra Solicitud"));

    expect(createAnotherButton).toBeTruthy();
    await createAnotherButton.trigger("click");
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.find("input#title").element.value).toBe("");
  });

  test("handleClose emits close only when not loading", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: true,
        organizations: buildOrganizations(),
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

    await wrapper.vm.handleClose();
    expect(wrapper.emitted("close")).toBeTruthy();

    const closeEventsBefore = wrapper.emitted("close").length;

    wrapper.vm.isLoading = true;
    await flushPromises();

    await wrapper.vm.handleClose();

    expect(wrapper.emitted("close").length).toBe(closeEventsBefore);
  });

  test("re-opening the modal resets the form", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getRequestTypes").mockResolvedValue([
      { id: 1, name: "Consulta" },
    ]);

    const wrapper = mount(CreateRequestModal, {
      props: {
        visible: false,
        organizations: buildOrganizations(),
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

    await wrapper.find("input#title").setValue("Título");
    expect(wrapper.find("input#title").element.value).toBe("Título");

    await wrapper.setProps({ visible: false });
    await flushPromises();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(wrapper.find("input#title").element.value).toBe("");
  });
});
