import { mount } from "@vue/test-utils";

import LegalRequestDetail from "@/components/legal-requests/LegalRequestDetail.vue";

const mockFetchRequestDetail = jest.fn();
const mockDownloadFile = jest.fn();
const mockRouterReplace = jest.fn();
const mockUserInit = jest.fn();
const mockUserById = jest.fn();

let mockLegalStore;
let mockAuthState = { userAuth: { id: 10 }, user: { id: 10, role: "client" } };

jest.mock("@/stores/legal/legal_requests_management.js", () => ({
  __esModule: true,
  useLegalRequestsStore: () => mockLegalStore,
}));

jest.mock("@/stores/auth/auth.js", () => ({
  __esModule: true,
  useAuthStore: () => mockAuthState,
}));

jest.mock("@/stores/auth/user.js", () => ({
  __esModule: true,
  useUserStore: () => ({
    init: mockUserInit,
    userById: mockUserById,
  }),
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRoute: () => ({ params: { id: "1" } }),
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  ExclamationTriangleIcon: { template: "<span />" },
  DocumentIcon: { template: "<span />" },
  ArrowDownTrayIcon: { template: "<span />" },
}));

const StatusBadgeStub = {
  name: "StatusBadge",
  props: ["status"],
  template: "<div data-test='status-badge'>{{ status }}</div>",
};

const ResponseThreadStub = {
  name: "ResponseThread",
  props: ["requestId", "responses", "userRole"],
  template: "<button data-test='emit-response' @click=\"$emit('response-added', { id: 9 })\">emit</button>",
};

const StatusUpdateModalStub = {
  name: "StatusUpdateModal",
  props: ["request"],
  template:
    "<div data-test='status-modal'><button data-test='status-updated' @click=\"$emit('updated', { ...request, status: 'RESPONDED' })\">ok</button></div>",
};

const DeleteConfirmModalStub = {
  name: "DeleteConfirmModal",
  props: ["request"],
  template: "<div data-test='delete-modal' />",
};

const AddFilesModalStub = {
  name: "AddFilesModal",
  props: ["request"],
  template:
    "<div data-test='add-files-modal'><button data-test='files-added' @click=\"$emit('files-added')\">added</button></div>",
};

const buildRequest = (overrides = {}) => ({
  id: 1,
  request_number: "REQ-1",
  first_name: "Ana",
  last_name: "Diaz",
  email: "ana@example.com",
  status: "PENDING",
  request_type: { name: "Consulta" },
  discipline: { name: "Civil" },
  description: "Detalle",
  created_at: "2026-02-01T00:00:00.000Z",
  files: [],
  responses: [],
  user: 10,
  ...overrides,
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("LegalRequestDetail.vue", () => {
  beforeEach(() => {
    mockFetchRequestDetail.mockReset();
    mockDownloadFile.mockReset();
    mockRouterReplace.mockReset();
    mockUserInit.mockResolvedValue();
    mockUserById.mockReset();
    mockAuthState = { userAuth: { id: 10 }, user: { id: 10, role: "client" } };

    mockLegalStore = {
      fetchRequestDetail: mockFetchRequestDetail,
      downloadFile: mockDownloadFile,
      currentRequest: null,
    };
  });

  test("renders request detail and updates status via modal", async () => {
    mockAuthState.user.role = "lawyer";
    mockUserById.mockReturnValue({ id: 10, role: "lawyer" });
    mockFetchRequestDetail.mockResolvedValue(buildRequest());

    const wrapper = mount(LegalRequestDetail, {
      props: { requestId: 1 },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
          ResponseThread: ResponseThreadStub,
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
          AddFilesModal: AddFilesModalStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("REQ-1");

    const statusButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Cambiar Estado"));

    expect(statusButton).toBeTruthy();
    await statusButton.trigger("click");

    expect(wrapper.find("[data-test='status-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='status-updated']").trigger("click");

    expect(wrapper.find("[data-test='status-modal']").exists()).toBe(false);
    expect(wrapper.find("[data-test='status-badge']").text()).toContain("RESPONDED");
  });

  test("shows add files CTA for owner client and refreshes after files-added", async () => {
    mockAuthState.user.role = "client";
    mockUserById.mockReturnValue({ id: 10, role: "client" });
    mockFetchRequestDetail.mockResolvedValue(buildRequest({ user: 10, status: "PENDING" }));

    const wrapper = mount(LegalRequestDetail, {
      props: { requestId: 1 },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
          ResponseThread: ResponseThreadStub,
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
          AddFilesModal: AddFilesModalStub,
        },
      },
    });

    await flushPromises();

    const addFilesButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Agregar archivos"));

    expect(addFilesButton).toBeTruthy();
    await addFilesButton.trigger("click");

    expect(wrapper.find("[data-test='add-files-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='files-added']").trigger("click");
    await flushPromises();

    expect(mockFetchRequestDetail).toHaveBeenCalledTimes(2);
  });

  test("shows error state and retries fetch", async () => {
    mockUserById.mockReturnValue({ id: 10, role: "client" });
    mockFetchRequestDetail
      .mockRejectedValueOnce(new Error("Boom"))
      .mockResolvedValueOnce(buildRequest());

    const wrapper = mount(LegalRequestDetail, {
      props: { requestId: 1 },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
          ResponseThread: ResponseThreadStub,
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
          AddFilesModal: AddFilesModalStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Error al cargar la solicitud");
    expect(wrapper.text()).toContain("Boom");

    const retryButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Reintentar"));

    await retryButton.trigger("click");
    await flushPromises();

    expect(mockFetchRequestDetail).toHaveBeenCalledTimes(2);
  });

  test("downloadFile shows alert when response data is missing", async () => {
    mockUserById.mockReturnValue({ id: 10, role: "client" });
    mockFetchRequestDetail.mockResolvedValue(
      buildRequest({
        files: [{ id: 1, file: "/docs/test.pdf", created_at: "2026-02-01T00:00:00.000Z" }],
      })
    );
    mockDownloadFile.mockResolvedValue({ data: null, headers: {} });

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(LegalRequestDetail, {
      props: { requestId: 1 },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
          ResponseThread: ResponseThreadStub,
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
          AddFilesModal: AddFilesModalStub,
        },
      },
    });

    await flushPromises();

    const downloadButton = wrapper.find("button[title='Descargar archivo']");
    await downloadButton.trigger("click");
    await flushPromises();

    expect(mockDownloadFile).toHaveBeenCalledWith(1, 1);
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("no se pudo descargar")
    );

    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("handleDeleted navigates back to list", async () => {
    mockUserById.mockReturnValue({ id: 10, role: "lawyer" });
    mockFetchRequestDetail.mockResolvedValue(buildRequest());
    mockRouterReplace.mockResolvedValue();

    const wrapper = mount(LegalRequestDetail, {
      props: { requestId: 1 },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
          ResponseThread: ResponseThreadStub,
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
          AddFilesModal: AddFilesModalStub,
        },
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.handleDeleted();

    expect(mockRouterReplace).toHaveBeenCalledWith({ name: "legal_requests_list" });
  });

  test("handleResponseAdded syncs responses and scrolls to latest message", async () => {
    mockUserById.mockReturnValue({ id: 10, role: "client" });

    const baseRequest = buildRequest({ responses: [] });
    mockFetchRequestDetail.mockResolvedValue(baseRequest);

    mockLegalStore.currentRequest = {
      id: 1,
      responses: [{ id: 5, response_text: "Ok" }],
    };

    const wrapper = mount(LegalRequestDetail, {
      props: { requestId: 1 },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
          ResponseThread: ResponseThreadStub,
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
          AddFilesModal: AddFilesModalStub,
        },
      },
    });

    await flushPromises();

    wrapper.vm.$.setupState.request.value = baseRequest;

    jest.useFakeTimers();

    const message = document.createElement("div");
    message.className = "response-message";
    const scrollSpy = jest.fn();
    message.scrollIntoView = scrollSpy;
    document.body.appendChild(message);

    await wrapper.vm.$.setupState.handleResponseAdded({ id: 5 });

    jest.runAllTimers();

    expect(wrapper.vm.$.setupState.request.value.responses).toEqual([
      { id: 5, response_text: "Ok" },
    ]);
    expect(scrollSpy).toHaveBeenCalled();

    document.body.removeChild(message);
    jest.useRealTimers();
  });
});
