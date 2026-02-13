import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";

import { useCorporateRequestsStore } from "@/stores/corporate_requests";
import { useUserStore } from "@/stores/auth/user";

import RequestDetailView from "@/components/organizations/shared/RequestDetailView.vue";

const mockRouterPush = jest.fn();
const mockRoute = reactive({ query: { id: "6001" } });

jest.mock("vue-router", () => ({
  __esModule: true,
  useRoute: () => mockRoute,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

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
    ArrowLeftIcon: IconStub,
    DocumentIcon: IconStub,
    ArrowDownTrayIcon: IconStub,
    ChatBubbleLeftIcon: IconStub,
    PaperAirplaneIcon: IconStub,
  };
});

const flushPromises = async () => {
  await Promise.resolve();

  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    return;
  }

  try {
    if (typeof jest.getTimerCount === "function" && jest.getTimerCount() > 0) {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      return;
    }
  } catch (error) {
    // Real timers in use; fall back to a macrotask.
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
};

const buildRequestDetail = (overrides = {}) => {
  return {
    id: 6001,
    request_number: "CORP-REQ-6001",
    title: "Solicitud",
    description: "Desc",
    request_type_name: "Consulta",
    status: "PENDING",
    priority: "MEDIUM",
    created_at: "2026-02-01T00:00:00.000Z",
    status_updated_at: "2026-02-01T00:00:00.000Z",
    days_since_created: 1,
    response_count: 0,
    responses: [],
    files: [],
    client_info: {
      full_name: "Client",
      email: "client@example.com",
      profile_image_url: "",
    },
    corporate_client_info: {
      full_name: "Corp",
      email: "corp@example.com",
      profile_image_url: "",
    },
    organization_info: {
      id: 1,
      title: "Acme",
      profile_image_url: "",
    },
    ...overrides,
  };
};

describe("RequestDetailView.vue", () => {
  beforeEach(() => {
    jest.useRealTimers();
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    // Ensure route.query.id is a normal writable data property for each test.
    Object.defineProperty(mockRoute.query, "id", {
      value: "6001",
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });

  test("shows error when no request id is provided", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    // Simulate: first access to route.query.id is truthy (so onMounted triggers loadRequestDetail),
    // second access is undefined (so loadRequestDetail throws 'ID de solicitud no proporcionado').
    let idAccessCount = 0;
    let currentId = "6001";
    Object.defineProperty(mockRoute.query, "id", {
      configurable: true,
      get() {
        idAccessCount += 1;
        // 1st access happens during watch() dependency collection
        // 2nd access happens in onMounted guard
        // 3rd access happens inside loadRequestDetail (should be undefined)
        if (idAccessCount <= 2) return currentId;
        return undefined;
      },
      set(v) {
        currentId = v;
      },
    });

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const myDetailSpy = jest.spyOn(requestsStore, "getMyRequestDetail").mockResolvedValue({});

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(myDetailSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Error al cargar la solicitud");
    expect(wrapper.text()).toContain("ID de solicitud no proporcionado");

    // Restore normal behavior for other tests
    Object.defineProperty(mockRoute.query, "id", {
      value: "6001",
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });

  test("shows error for invalid user role", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "lawyer" } });

    const requestsStore = useCorporateRequestsStore();
    const myDetailSpy = jest.spyOn(requestsStore, "getMyRequestDetail").mockResolvedValue({});
    const receivedDetailSpy = jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({});

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(myDetailSpy).not.toHaveBeenCalled();
    expect(receivedDetailSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Rol de usuario no válido");
  });

  test("shows backend error response when load fails", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getMyRequestDetail").mockRejectedValue({
      response: { data: { error: "Backend error" } },
    });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Error al cargar la solicitud");
    expect(wrapper.text()).toContain("Backend error");
  });

  test("shows error message when request detail rejects with Error", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockRejectedValue(new Error("Boom"));

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Error al cargar la solicitud");
    expect(wrapper.text()).toContain("Boom");
  });

  test("shows default error message when load fails without details", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    jest.spyOn(requestsStore, "getMyRequestDetail").mockRejectedValue({});

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Error al cargar la solicitud");
  });

  test("corporate loads detail via getReceivedRequestDetail and shows internal note checkbox", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    const receivedDetailSpy = jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    jest.spyOn(requestsStore, "getMyRequestDetail").mockResolvedValue({ corporate_request: detail });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(receivedDetailSpy).toHaveBeenCalledWith("6001");
    expect(wrapper.text()).toContain("Detalles de la Solicitud");
    expect(wrapper.text()).toContain("Solicitud CORP-REQ-6001");

    expect(wrapper.text()).toContain("Nota interna (solo visible para el equipo corporativo)");
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);

    // corporate status actions visible
    expect(wrapper.find("select#status").exists()).toBe(true);
  });

  test("client loads detail via getMyRequestDetail and does not show internal note checkbox or status actions", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    const myDetailSpy = jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    jest.spyOn(requestsStore, "getReceivedRequestDetail").mockResolvedValue({ corporate_request: detail });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(myDetailSpy).toHaveBeenCalledWith("6001");
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.find("select#status").exists()).toBe(false);
  });

  test("reloads request when route query id changes", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detailSpy = jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValueOnce({
        corporate_request: buildRequestDetail({
          id: 6001,
          request_number: "CORP-REQ-6001",
        }),
      })
      .mockResolvedValueOnce({
        corporate_request: buildRequestDetail({
          id: 7002,
          request_number: "CORP-REQ-7002",
        }),
      });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    mockRoute.query.id = "7002";
    await flushPromises();

    expect(detailSpy).toHaveBeenCalledWith("6001");
    expect(detailSpy).toHaveBeenCalledWith("7002");
    expect(wrapper.text()).toContain("Solicitud CORP-REQ-7002");
  });

  test("loads request when route id becomes available", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detailSpy = jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: buildRequestDetail() });

    mockRoute.query.id = null;

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    expect(detailSpy).not.toHaveBeenCalled();

    mockRoute.query.id = "6001";
    await flushPromises();

    expect(detailSpy).toHaveBeenCalledWith("6001");
    expect(wrapper.text()).toContain("Solicitud CORP-REQ-6001");
  });

  test("corporate submitResponse includes is_internal_note and syncs responses from store.currentRequest", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const addRespSpy = jest
      .spyOn(requestsStore, "addResponseToReceivedRequest")
      .mockImplementation(async (_requestId, responseData) => {
        requestsStore.currentRequest = {
          ...detail,
          responses: [
            {
              id: 1,
              user_type: "corporate_client",
              user_name: "Corp",
              is_internal_note: true,
              response_text: responseData.response_text,
              created_at: "2026-02-02T00:00:00.000Z",
            },
          ],
          response_count: 1,
        };

        return { ok: true };
      });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("textarea#response").setValue("  Nota  ");
    await wrapper.find('input[type="checkbox"]').setValue(true);

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(addRespSpy).toHaveBeenCalledWith(6001, {
      response_text: "Nota",
      is_internal_note: true,
    });

    expect(wrapper.text()).toContain("Nota Interna");
    expect(wrapper.text()).toContain("Conversación (1 respuestas)");

    expect(wrapper.find("textarea#response").element.value).toBe("");
    expect(wrapper.find('input[type="checkbox"]').element.checked).toBe(false);
  });

  test("client submitResponse uses addResponseToMyRequest and shows user type fallback", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const addRespSpy = jest
      .spyOn(requestsStore, "addResponseToMyRequest")
      .mockImplementation(async (_requestId, responseData) => {
        requestsStore.currentRequest = {
          ...detail,
          responses: [
            {
              id: 1,
              user_type: "partner",
              user_name: "Partner",
              response_text: responseData.response_text,
              created_at: "2026-02-02T00:00:00.000Z",
            },
          ],
          response_count: 1,
        };

        return { ok: true };
      });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("textarea#response").setValue(" Hola ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(addRespSpy).toHaveBeenCalledWith(6001, {
      response_text: "Hola",
    });

    expect(wrapper.text()).toContain("partner");
    expect(wrapper.find("textarea#response").element.value).toBe("");
  });

  test("submitResponse error shows notification and does not clear form", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    jest.spyOn(requestsStore, "addResponseToReceivedRequest").mockRejectedValue({
      response: {
        data: {
          error: "Nope",
        },
      },
    });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("textarea#response").setValue("  Nota  ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Nope", "error");
    expect(wrapper.find("textarea#response").element.value).toBe("  Nota  ");
  });

  test("submitResponse generic error shows default notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    jest
      .spyOn(requestsStore, "addResponseToMyRequest")
      .mockRejectedValue(new Error("fail"));

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("textarea#response").setValue("  Nota  ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al enviar la respuesta",
      "error"
    );
    expect(wrapper.find("textarea#response").element.value).toBe("  Nota  ");
  });

  test("corporate updateStatus success calls updateReceivedRequest, updates local status, and notifies", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail({ status: "PENDING" });

    jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const updateSpy = jest
      .spyOn(requestsStore, "updateReceivedRequest")
      .mockResolvedValue({ corporate_request: { ...detail, status: "RESOLVED" } });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("select#status").setValue("RESOLVED");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith(6001, { status: "RESOLVED" });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Estado actualizado exitosamente",
      "success"
    );

    // Badge should show updated status
    expect(wrapper.text()).toContain("Resuelta");
  });

  test("corporate updateStatus error reverts selectedStatus and shows error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail({ status: "PENDING" });

    jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const updateSpy = jest
      .spyOn(requestsStore, "updateReceivedRequest")
      .mockRejectedValue({ response: { data: { error: "Bad" } } });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("select#status").setValue("RESOLVED");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith(6001, { status: "RESOLVED" });
    expect(mockShowNotification).toHaveBeenCalledWith("Bad", "error");

    // select should revert
    expect(wrapper.find("select#status").element.value).toBe("PENDING");
    // badge should remain pending
    expect(wrapper.text()).toContain("Pendiente");
  });

  test("updateStatus returns early when status is unchanged", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail({ status: "PENDING" });

    jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const updateSpy = jest
      .spyOn(requestsStore, "updateReceivedRequest")
      .mockResolvedValue({});

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.updateStatus();

    expect(updateSpy).not.toHaveBeenCalled();
  });

  test("updateStatus generic error shows default notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "corporate_client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail({ status: "PENDING" });

    jest
      .spyOn(requestsStore, "getReceivedRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    jest
      .spyOn(requestsStore, "updateReceivedRequest")
      .mockRejectedValue(new Error("fail"));

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    await wrapper.find("select#status").setValue("RESOLVED");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al actualizar el estado",
      "error"
    );
    expect(wrapper.find("select#status").element.value).toBe("PENDING");
  });

  test("goBack navigates to organizations_dashboard", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail();

    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const backBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Volver"));

    expect(backBtn).toBeTruthy();

    await backBtn.trigger("click");
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "organizations_dashboard" });
  });

  test("displays file attachments with formatted sizes when request has files", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    const detail = buildRequestDetail({
      files: [
        { id: 1, file_name: "doc.pdf", file_size: 0, file_url: "/f1" },
        { id: 2, file_name: "image.jpg", file_size: 1024, file_url: "/f2" },
        { id: 3, file_name: "large.zip", file_size: 1048576, file_url: "/f3" },
        { id: 4, file_name: "huge.mp4", file_size: 1073741824, file_url: "/f4" },
      ],
    });

    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: detail });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("0 Bytes");
    expect(wrapper.text()).toContain("1 KB");
    expect(wrapper.text()).toContain("1 MB");
    expect(wrapper.text()).toContain("1 GB");
  });

  test("formatRelativeDate handles today, yesterday, days, and fallback", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-10T00:00:00.000Z"));

    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: buildRequestDetail() });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await wrapper.vm.$nextTick();

    const { formatRelativeDate, formatDate } = wrapper.vm.$.setupState;

    expect(formatRelativeDate("2026-02-10T12:00:00.000Z")).toBe("Hoy");
    expect(formatRelativeDate("2026-02-09T12:00:00.000Z")).toBe("Ayer");
    expect(formatRelativeDate("2026-02-07T12:00:00.000Z")).toBe("Hace 3 días");

    const olderDate = "2026-01-20T12:00:00.000Z";
    expect(formatRelativeDate(olderDate)).toBe(formatDate(olderDate));

    jest.useRealTimers();
  });

  test("uses fallback labels for unknown status and priority values", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({
        corporate_request: buildRequestDetail({
          status: "CUSTOM_STATUS",
          priority: "CUSTOM_PRIORITY",
        }),
      });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const statusBadge = wrapper
      .findAll("span")
      .find((span) => span.text() === "CUSTOM_STATUS");

    const priorityBadge = wrapper
      .findAll("span")
      .find((span) => span.text() === "CUSTOM_PRIORITY");

    expect(statusBadge).toBeTruthy();
    expect(priorityBadge).toBeTruthy();
    expect(statusBadge.classes()).toEqual(
      expect.arrayContaining(["bg-gray-100", "text-gray-800"])
    );
    expect(priorityBadge.classes()).toEqual(
      expect.arrayContaining(["bg-gray-100", "text-gray-600"])
    );
  });

  test("utility helpers fall back for unknown values", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    const requestsStore = useCorporateRequestsStore();
    jest
      .spyOn(requestsStore, "getMyRequestDetail")
      .mockResolvedValue({ corporate_request: buildRequestDetail() });

    const wrapper = mount(RequestDetailView, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const {
      getStatusDisplay,
      getStatusColorClass,
      getPriorityDisplay,
      getPriorityColorClass,
      getUserTypeDisplay,
    } = wrapper.vm.$.setupState;

    expect(getStatusDisplay("UNKNOWN")).toBe("UNKNOWN");
    expect(getStatusColorClass("UNKNOWN")).toBe("bg-gray-100 text-gray-800");
    expect(getPriorityDisplay("UNKNOWN")).toBe("UNKNOWN");
    expect(getPriorityColorClass("UNKNOWN")).toBe("bg-gray-100 text-gray-600");
    expect(getUserTypeDisplay("partner")).toBe("partner");
  });
});
