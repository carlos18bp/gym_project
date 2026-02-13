import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import CreateOrganizationModal from "@/components/organizations/modals/CreateOrganizationModal.vue";

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
    PhotoIcon: IconStub,
    InformationCircleIcon: IconStub,
    CheckCircleIcon: IconStub,
    BuildingOfficeIcon: IconStub,
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

describe("CreateOrganizationModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    global.FileReader = class {
      constructor() {
        this.onload = null;
      }
      readAsDataURL() {
        if (this.onload) {
          this.onload({ target: { result: "data:image/png;base64,TEST" } });
        }
      }
    };
  });

  test("submit is disabled until title and description are provided", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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
    expect(submitBtn.exists()).toBe(true);
    expect(submitBtn.attributes("disabled")).toBeDefined();

    await wrapper.find("input#title").setValue("  Org  ");
    await flushPromises();

    expect(submitBtn.attributes("disabled")).toBeDefined();

    await wrapper.find("textarea#description").setValue("  Desc  ");
    await flushPromises();

    expect(submitBtn.attributes("disabled")).toBeUndefined();
  });

  test("opening the modal resets the form", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: false,
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

    await wrapper.find("input#title").setValue("Org");
    await wrapper.find("textarea#description").setValue("Desc");

    await wrapper.setProps({ visible: false });
    await flushPromises();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(wrapper.find("input#title").element.value).toBe("");
    expect(wrapper.find("textarea#description").element.value).toBe("");
  });

  test("successful submit calls createOrganization, shows success state, notifies and emits created", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    const createSpy = jest
      .spyOn(organizationsStore, "createOrganization")
      .mockResolvedValue({ organization: { id: 10, title: "Org Created" } });

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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

    await wrapper.find("input#title").setValue("  Org Created  ");
    await wrapper.find("textarea#description").setValue("  Desc  ");

    const fileInputs = wrapper.findAll('input[type="file"]');
    expect(fileInputs.length).toBe(2);

    const profileFile = new File(["x"], "p.png", { type: "image/png" });
    const coverFile = new File(["y"], "c.png", { type: "image/png" });

    Object.defineProperty(fileInputs[0].element, "files", {
      value: [profileFile],
      configurable: true,
    });
    Object.defineProperty(fileInputs[1].element, "files", {
      value: [coverFile],
      configurable: true,
    });

    await fileInputs[0].trigger("change");
    await fileInputs[1].trigger("change");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({
      title: "Org Created",
      description: "Desc",
      profile_image: profileFile,
      cover_image: coverFile,
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Organización creada exitosamente",
      "success"
    );

    expect(wrapper.emitted("created")).toBeTruthy();
    expect(wrapper.emitted("created")[0]).toEqual([{ id: 10, title: "Org Created" }]);

    expect(wrapper.text()).toContain("¡Organización Creada!");
    expect(wrapper.text()).toContain("Org Created");
  });

  test("resetAndCreateAnother clears success state and returns to the form", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest
      .spyOn(organizationsStore, "createOrganization")
      .mockResolvedValue({ organization: { id: 10, title: "Org Created" } });

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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

    await wrapper.find("input#title").setValue("Org Created");
    await wrapper.find("textarea#description").setValue("Desc");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("¡Organización Creada!");

    const createAnotherBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Crear Otra Organización"));

    expect(createAnotherBtn).toBeTruthy();

    await createAnotherBtn.trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("¡Organización Creada!");
    expect(wrapper.find("input#title").element.value).toBe("");
    expect(wrapper.find("textarea#description").element.value).toBe("");
  });

  test("submit error with response.data.details displays field errors", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "createOrganization").mockRejectedValue({
      response: {
        data: {
          details: {
            title: ["Title invalid"],
          },
        },
      },
    });

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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

    await wrapper.find("input#title").setValue("Org");
    await wrapper.find("textarea#description").setValue("Desc");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Title invalid");
  });

  test("invalid image file type shows warning notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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

    const fileInputs = wrapper.findAll('input[type="file"]');
    const badFile = new File(["x"], "x.txt", { type: "text/plain" });

    Object.defineProperty(fileInputs[0].element, "files", {
      value: [badFile],
      configurable: true,
    });

    await fileInputs[0].trigger("change");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Solo se permiten archivos de imagen",
      "warning"
    );
  });

  test("image larger than 5MB shows warning notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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

    const fileInputs = wrapper.findAll('input[type="file"]');
    const bigFile = { size: 6 * 1024 * 1024, type: "image/png", name: "big.png" };

    Object.defineProperty(fileInputs[0].element, "files", {
      value: [bigFile],
      configurable: true,
    });

    await fileInputs[0].trigger("change");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "La imagen debe ser menor a 5MB",
      "warning"
    );
  });

  test("error response.data.error shows error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "createOrganization").mockRejectedValue({
      response: {
        data: {
          error: "Custom error",
        },
      },
    });

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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

    await wrapper.find("input#title").setValue("Org");
    await wrapper.find("textarea#description").setValue("Desc");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Custom error", "error");
  });

  test("cancel emits close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(CreateOrganizationModal, {
      props: {
        visible: true,
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
});
