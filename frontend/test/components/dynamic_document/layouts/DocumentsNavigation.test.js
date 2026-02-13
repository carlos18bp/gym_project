import { mount } from "@vue/test-utils";

import DocumentsNavigation from "@/components/dynamic_document/layouts/DocumentsNavigation.vue";

const mockShowNotification = jest.fn();

let mockAuthStore;
let mockUserStore;

jest.mock("@/stores/auth/auth", () => ({
  __esModule: true,
  useAuthStore: () => mockAuthStore,
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  FolderIcon: { template: "<span />" },
  PlusIcon: { template: "<span />" },
  FingerPrintIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
}));

const mountView = (props) =>
  mount(DocumentsNavigation, {
    props,
    global: {
      stubs: {
        ModalTransition: { template: "<div><slot /></div>" },
        ElectronicSignature: { template: "<div />" },
        GlobalLetterheadModal: { template: "<div />" },
      },
    },
  });

describe("DocumentsNavigation.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = { currentUser: { id: 1, role: "lawyer" } };
    mockAuthStore = {
      userAuth: { id: 1, has_signature: false },
      saveToLocalStorageAuth: jest.fn(),
    };
  });

  test("emits openNewDocument for lawyer role", async () => {
    const wrapper = mountView({ role: "lawyer" });

    const button = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Nuevo Documento"));

    await button.trigger("click");

    expect(wrapper.emitted("openNewDocument")).toBeTruthy();
  });

  test("emits updateCurrentSection for client role", async () => {
    const wrapper = mountView({ role: "client" });

    const button = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Mis Documentos"));

    await button.trigger("click");

    expect(wrapper.emitted("updateCurrentSection")[0]).toEqual(["default"]);
  });

  test("handleSignatureSaved updates auth store and closes modal", async () => {
    const wrapper = mountView({ role: "lawyer" });

    wrapper.vm.$.setupState.showElectronicSignatureModal = true;

    await wrapper.vm.handleSignatureSaved({});

    expect(mockAuthStore.userAuth.has_signature).toBe(true);
    expect(mockAuthStore.saveToLocalStorageAuth).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Firma electrónica guardada correctamente",
      "success"
    );
    expect(wrapper.vm.$.setupState.showElectronicSignatureModal).toBe(false);
  });

  test("handleSignatureSaved logs error and shows warning on failure", async () => {
    const error = new Error("fail");
    mockAuthStore.saveToLocalStorageAuth.mockImplementation(() => {
      throw error;
    });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mountView({ role: "lawyer" });

    await wrapper.vm.handleSignatureSaved({});

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error updating signature information:",
      error
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Hubo un problema al guardar la firma",
      "error"
    );

    consoleSpy.mockRestore();
  });

  test("emits global letterhead events", async () => {
    const wrapper = mountView({ role: "lawyer" });

    wrapper.vm.handleGlobalLetterheadUploaded({ id: 1 });
    wrapper.vm.handleGlobalLetterheadDeleted();

    expect(wrapper.emitted("globalLetterheadUploaded")).toBeTruthy();
    expect(wrapper.emitted("globalLetterheadDeleted")).toBeTruthy();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Membrete global subido correctamente",
      "success"
    );
  });
});
