import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import EditOrganizationModal from "@/components/organizations/modals/EditOrganizationModal.vue";

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
  };
});

jest.mock("@/assets/images/user_avatar.jpg", () => "avatar.jpg");

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
    description: "Org desc",
    is_active: true,
    profile_image_url: "",
    cover_image_url: "",
    ...overrides,
  };
};

describe("EditOrganizationModal.vue", () => {
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

  test("opening modal resets form fields from organization props", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: false,
        organization: buildOrganization({
          title: "Org A",
          description: "Desc A",
          is_active: false,
        }),
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

    expect(wrapper.find("input#title").element.value).toBe("Org A");
    expect(wrapper.find("textarea#description").element.value).toBe("Desc A");
    expect(wrapper.find("input#inactive").element.checked).toBe(true);
  });

  test("changing organization while visible resets form", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: false,
        organization: buildOrganization({ title: "Org A", description: "Desc A" }),
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

    expect(wrapper.find("input#title").element.value).toBe("Org A");

    await wrapper.setProps({
      organization: buildOrganization({ title: "Org B", description: "Desc B" }),
    });
    await flushPromises();

    expect(wrapper.find("input#title").element.value).toBe("Org B");
    expect(wrapper.find("textarea#description").element.value).toBe("Desc B");
  });

  test("opening modal without organization resets form to defaults", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
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

    expect(wrapper.find("input#title").element.value).toBe("");
    expect(wrapper.find("textarea#description").element.value).toBe("");
    expect(wrapper.find("input#active").element.checked).toBe(true);
  });

  test("successful submit calls updateOrganization with updated fields and images, notifies and emits updated", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    const updateSpy = jest
      .spyOn(organizationsStore, "updateOrganization")
      .mockResolvedValue({ organization: { id: 5, title: "Updated" } });

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 5, title: "Org A", description: "Desc A", is_active: true }),
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

    await wrapper.find("input#title").setValue("Org Updated");
    await wrapper.find("textarea#description").setValue("New desc");

    await wrapper.find("input#inactive").setChecked();

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

    expect(updateSpy).toHaveBeenCalledWith(5, {
      title: "Org Updated",
      description: "New desc",
      is_active: false,
      profile_image: profileFile,
      cover_image: coverFile,
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Organización actualizada exitosamente",
      "success"
    );

    expect(wrapper.emitted("updated")).toBeTruthy();
    expect(wrapper.emitted("updated")[0]).toEqual([{ id: 5, title: "Updated" }]);
  });

  test("submit error with response.data.details displays field errors", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "updateOrganization").mockRejectedValue({
      response: {
        data: {
          details: {
            title: ["Title invalid"],
          },
        },
      },
    });

    const wrapper = mount(EditOrganizationModal, {
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

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Title invalid");
  });

  test("invalid image file type shows warning notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 2 }),
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

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 2 }),
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

  test("cover image invalid type shows warning notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 3 }),
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

    Object.defineProperty(fileInputs[1].element, "files", {
      value: [badFile],
      configurable: true,
    });

    await fileInputs[1].trigger("change");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Solo se permiten archivos de imagen",
      "warning"
    );
  });

  test("cover image larger than 5MB shows warning notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
      props: {
        visible: true,
        organization: buildOrganization({ id: 4 }),
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

    Object.defineProperty(fileInputs[1].element, "files", {
      value: [bigFile],
      configurable: true,
    });

    await fileInputs[1].trigger("change");
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
    jest.spyOn(organizationsStore, "updateOrganization").mockRejectedValue({
      response: {
        data: {
          error: "Custom error",
        },
      },
    });

    const wrapper = mount(EditOrganizationModal, {
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

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Custom error", "error");
  });

  test("generic error shows default error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const organizationsStore = useOrganizationsStore();
    jest.spyOn(organizationsStore, "updateOrganization").mockRejectedValue({});

    const wrapper = mount(EditOrganizationModal, {
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

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al actualizar la organización",
      "error"
    );
  });

  test("handleClose does not emit when loading", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
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

    wrapper.vm.isLoading = true;
    await wrapper.vm.$nextTick();

    const closeBtn = wrapper.find("button");
    expect(closeBtn.exists()).toBe(true);

    await closeBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeFalsy();
  });

  test("cancel button emits close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(EditOrganizationModal, {
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
});
