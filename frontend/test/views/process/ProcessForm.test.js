import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { reactive, nextTick } from "vue";

import ProcessForm from "@/views/process/ProcessForm.vue";
import { useCaseTypeStore } from "@/stores/legal/case_type";
import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";
import { useProcessStore } from "@/stores/process";

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
const mockSubmitHandler = jest.fn();
const mockSwalFire = jest.fn();
const mockShowNotification = jest.fn();

let mockRoute;

jest.mock("@/router", () => ({
  __esModule: true,
  default: {
    push: (...args) => mockRouterPush(...args),
    back: () => mockRouterBack(),
  },
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRoute: () => mockRoute,
}));

jest.mock("@/shared/submit_handler", () => ({
  __esModule: true,
  submitHandler: (...args) => mockSubmitHandler(...args),
}));

jest.mock("@/shared/notification_message.js", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: (...args) => mockSwalFire(...args),
  },
}));

jest.mock("@headlessui/vue", () => ({
  __esModule: true,
  Combobox: { name: "Combobox", template: "<div><slot /></div>" },
  ComboboxButton: { name: "ComboboxButton", template: "<button><slot /></button>" },
  ComboboxInput: { name: "ComboboxInput", template: "<input />" },
  ComboboxLabel: { name: "ComboboxLabel", template: "<label><slot /></label>" },
  ComboboxOptions: { name: "ComboboxOptions", template: "<div><slot /></div>" },
  ComboboxOption: {
    name: "ComboboxOption",
    setup(_, { slots }) {
      return () => (slots.default ? slots.default({ active: false, selected: false }) : null);
    },
  },
}));

jest.mock("@heroicons/vue/20/solid", () => ({
  __esModule: true,
  CheckIcon: { template: "<span />" },
  ChevronDownIcon: { template: "<span />" },
  PlusIcon: { template: "<span />" },
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  TrashIcon: { template: "<span />" },
  EyeIcon: { template: "<span />" },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildProcess = (overrides = {}) => ({
  id: 101,
  plaintiff: "Alice",
  defendant: "Bob",
  case: { id: 10, type: "Civil" },
  subcase: "Subcase",
  ref: "REF-1",
  authority: "Court",
  authority_email: "court@test.com",
  clients: [{ id: 1, first_name: "Ana", last_name: "Lopez", role: "client" }],
  lawyer: { id: 99 },
  progress: 20,
  stages: [{ status: "Admisión", date: "2024-01-01" }],
  case_files: [{ id: 5, file: "http://files.test/file.pdf" }],
  ...overrides,
});

const createFile = (name, type, size = 1000) => {
  const file = new File([new ArrayBuffer(8)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const mountView = async ({
  routeParams = { action: "add", process_id: "" },
  processes = [],
  caseTypes = [],
  users = [],
  currentUser = { id: 99, role: "lawyer" },
  authUser = { id: 99 },
} = {}) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const processStore = useProcessStore();
  const caseTypeStore = useCaseTypeStore();
  const userStore = useUserStore();
  const authStore = useAuthStore();

  processStore.$patch({ processes });
  caseTypeStore.$patch({ caseTypes });
  userStore.$patch({ users, currentUser });
  authStore.$patch({ userAuth: authUser });

  const processInitSpy = jest.spyOn(processStore, "init").mockResolvedValue();
  const caseTypeInitSpy = jest.spyOn(caseTypeStore, "init").mockResolvedValue();
  const userInitSpy = jest.spyOn(userStore, "init").mockResolvedValue();

  mockRoute.params = routeParams;

  const wrapper = shallowMount(ProcessForm, {
    global: {
      plugins: [pinia],
    },
  });

  await flushPromises();

  return {
    wrapper,
    processInitSpy,
    caseTypeInitSpy,
    userInitSpy,
    processStore,
    caseTypeStore,
    userStore,
    authStore,
  };
};

const mountEditView = async (processOverrides = {}) => {
  const process = buildProcess(processOverrides);
  const view = await mountView({
    routeParams: { action: "edit", process_id: String(process.id) },
    processes: [process],
  });

  return { ...view, process };
};

describe("ProcessForm.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute = reactive({ params: { action: "add", process_id: "" } });
  });

  test("loads process data in edit mode", async () => {
    const { wrapper, processInitSpy, caseTypeInitSpy, userInitSpy, process } = await mountEditView();

    expect([processInitSpy, caseTypeInitSpy, userInitSpy].every((spy) => spy.mock.calls.length)).toBe(true);
    expect([
      wrapper.vm.$.setupState.formData.plaintiff,
      wrapper.vm.$.setupState.formData.authorityEmail,
      wrapper.vm.$.setupState.selectedCaseType,
      wrapper.vm.$.setupState.selectedClients.length,
      wrapper.vm.$.setupState.formData.caseFiles.length,
      wrapper.vm.$.setupState.isFormModified,
      wrapper.vm.$.setupState.isSaveButtonEnabled,
    ]).toEqual(["Alice", "court@test.com", process.case, 1, 1, false, true]);
  });

  test("tracks changes and resets when route action changes", async () => {
    const { wrapper } = await mountEditView();

    wrapper.vm.$.setupState.formData.plaintiff = "Updated";
    await nextTick();
    expect(wrapper.vm.$.setupState.isFormModified).toBe(true);

    mockRoute.params.action = "add";
    await nextTick();
    expect(wrapper.vm.$.setupState.formData.plaintiff).toBe("");
  });

  test("submits a valid new process and navigates to list", async () => {
    const client = { id: 7, first_name: "Ana", last_name: "Lopez", role: "client" };

    const { wrapper } = await mountView({
      routeParams: { action: "add", process_id: "" },
      caseTypes: [{ id: 10, type: "Civil" }],
      users: [client],
      authUser: { id: 55 },
    });

    wrapper.vm.$.setupState.selectedCaseType = { id: 10, type: "Civil" };
    wrapper.vm.$.setupState.selectedClients = [client];

    wrapper.vm.$.setupState.formData.plaintiff = "Plaintiff";
    wrapper.vm.$.setupState.formData.defendant = "Defendant";
    wrapper.vm.$.setupState.formData.subcase = "Sub";
    wrapper.vm.$.setupState.formData.ref = "REF";
    wrapper.vm.$.setupState.formData.authority = "Court";
    wrapper.vm.$.setupState.formData.stages = [{ status: "Inicio", date: "2024-01-01" }];
    wrapper.vm.$.setupState.formData.caseFiles = [
      { file: createFile("file.pdf", "application/pdf") },
    ];

    mockSubmitHandler.mockResolvedValue();

    await wrapper.vm.$.setupState.onSubmit();

    expect(mockSubmitHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        plaintiff: "Plaintiff",
        caseTypeId: 10,
        clientIds: [7],
        lawyerId: 55,
      }),
      expect.stringContaining("guardado exitosamente"),
      false
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "process_list",
      params: { user_id: "", display: "" },
    });
  });

  test("blocks submit when required fields are missing", async () => {
    const { wrapper } = await mountView({
      routeParams: { action: "add", process_id: "" },
      authUser: { id: 42 },
    });

    wrapper.vm.$.setupState.selectedCaseType = { id: 10, type: "Civil" };
    wrapper.vm.$.setupState.selectedClients = [{ id: 1, role: "client" }];
    wrapper.vm.$.setupState.formData.defendant = "Defendant";
    wrapper.vm.$.setupState.formData.subcase = "Sub";
    wrapper.vm.$.setupState.formData.ref = "REF";
    wrapper.vm.$.setupState.formData.authority = "Court";
    wrapper.vm.$.setupState.formData.stages = [{ status: "Inicio", date: "2024-01-01" }];
    wrapper.vm.$.setupState.formData.caseFiles = [
      { file: createFile("file.pdf", "application/pdf") },
    ];

    await wrapper.vm.$.setupState.onSubmit();

    expect(mockSwalFire).toHaveBeenCalled();
    expect(mockSubmitHandler).not.toHaveBeenCalled();
  });

  test("archives a process when confirmed", async () => {
    const client = { id: 3, first_name: "Ana", last_name: "Lopez", role: "client" };
    const process = buildProcess({ id: 77, clients: [client] });

    const { wrapper } = await mountView({
      routeParams: { action: "edit", process_id: "77" },
      processes: [process],
      authUser: { id: 55 },
    });

    wrapper.vm.$.setupState.selectedCaseType = { id: 10, type: "Civil" };
    wrapper.vm.$.setupState.selectedClients = [client];
    wrapper.vm.$.setupState.formData.caseFiles = [
      { file: createFile("file.pdf", "application/pdf") },
    ];

    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true });
    mockSubmitHandler.mockResolvedValue();

    await wrapper.vm.$.setupState.archiveProcess();

    expect(wrapper.vm.$.setupState.formData.isArchiving).toBe(true);
    expect(wrapper.vm.$.setupState.formData.stages.slice(-1)[0].status).toBe("Fallo");
    expect(mockSubmitHandler).toHaveBeenCalledWith(
      expect.objectContaining({ processIdParam: "77" }),
      expect.stringContaining("archivado exitosamente"),
      true
    );
    expect(mockRouterBack).toHaveBeenCalled();
  });

  test("manages client selection and removal", async () => {
    const { wrapper } = await mountView();
    const client = { id: 5, first_name: "Ana", last_name: "Lopez" };

    wrapper.vm.$.setupState.onClientSelected(client);
    wrapper.vm.$.setupState.onClientSelected(client);

    expect([
      wrapper.vm.$.setupState.selectedClients.length,
      wrapper.vm.$.setupState.isClientSelected(client),
    ]).toEqual([1, true]);

    wrapper.vm.$.setupState.removeClient(5);
    expect([
      wrapper.vm.$.setupState.selectedClients.length,
      wrapper.vm.$.setupState.formData.clientIds,
    ]).toEqual([0, []]);
  });

  test("manages stages and case files", async () => {
    const { wrapper } = await mountView();
    const formData = wrapper.vm.$.setupState.formData;

    const initialStages = formData.stages.length;
    wrapper.vm.$.setupState.addStage();
    const stagesAfterAdd = formData.stages.length;
    wrapper.vm.$.setupState.deleteStage(0);
    const stagesAfterDelete = formData.stages.length;

    const initialFiles = formData.caseFiles.length;
    wrapper.vm.$.setupState.addCaseFile();
    const filesAfterAdd = formData.caseFiles.length;
    wrapper.vm.$.setupState.removeCaseFile(0);
    const filesAfterRemove = formData.caseFiles.length;

    expect([stagesAfterAdd, stagesAfterDelete, filesAfterAdd, filesAfterRemove]).toEqual([
      initialStages + 1,
      initialStages,
      initialFiles + 1,
      initialFiles,
    ]);
  });

  test("handles file uploads and openFile", async () => {
    const { wrapper } = await mountView();

    const largeFile = createFile("large.pdf", "application/pdf", 51 * 1024 * 1024);
    wrapper.vm.$.setupState.handleFileUpload({ target: { files: [largeFile] } }, 0);

    const invalidFile = createFile("virus.exe", "application/octet-stream", 1000);
    wrapper.vm.$.setupState.handleFileUpload({ target: { files: [invalidFile] } }, 0);

    const validFile = createFile("file.pdf", "application/pdf", 1000);
    wrapper.vm.$.setupState.handleFileUpload({ target: { files: [validFile] } }, 0);

    expect(mockShowNotification).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.formData.caseFiles[0].file).toBe(validFile);

    const openSpy = jest.spyOn(window, "open").mockImplementation(() => {});
    wrapper.vm.$.setupState.openFile("http://files.test/file.pdf");
    expect(openSpy).toHaveBeenCalledWith("http://files.test/file.pdf", "_blank");
    openSpy.mockRestore();
  });
});
