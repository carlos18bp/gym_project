import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useIntranetGymStore } from "@/stores/legal/intranet_gym";
import { useUserStore } from "@/stores/auth/user";

import FacturationForm from "@/views/intranet_g_y_m/FacturationForm.vue";

const mockShowNotification = jest.fn();
const mockShowLoading = jest.fn();
const mockHideLoading = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/loading_message", () => ({
  __esModule: true,
  showLoading: (...args) => mockShowLoading(...args),
  hideLoading: (...args) => mockHideLoading(...args),
}));

jest.mock("vue-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    XMarkIcon: IconStub,
    CloudArrowUpIcon: IconStub,
    PhotoIcon: IconStub,
    DocumentIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function mountForm(pinia) {
  return mount(FacturationForm, {
    global: {
      plugins: [pinia],
    },
  });
}

describe("FacturationForm.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    const userStore = useUserStore();
    userStore.currentUser = {
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    };
    jest.spyOn(userStore, "init").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // quality: disable too_many_assertions (verifying all form fields render in a single mount)
  test("renders all required form fields", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    expect(wrapper.find("#document-number").exists()).toBe(true);
    expect(wrapper.find("#initial-report-period").exists()).toBe(true);
    expect(wrapper.find("#final-report-period").exists()).toBe(true);
    expect(wrapper.find("#payment-concept").exists()).toBe(true);
    expect(wrapper.find('input[aria-describedby="payment-currency"]').exists()).toBe(true);
    expect(wrapper.find("#file-upload").exists()).toBe(true);

    expect(wrapper.text()).toContain("No. Contrato");
    expect(wrapper.text()).toContain("Fecha Inicial");
    expect(wrapper.text()).toContain("Fecha Final");
    expect(wrapper.text()).toContain("Concepto de Pago");
    expect(wrapper.text()).toContain("Valor a Cobrar");
  });

  test("save button is disabled when required fields are empty", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.exists()).toBe(true);
    expect(submitBtn.attributes("disabled")).toBeDefined();
    expect(submitBtn.text()).toContain("Guardar");
  });

  test("save button becomes enabled when all required fields are filled", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    await wrapper.find("#document-number").setValue("CT-001");
    await wrapper.find("#initial-report-period").setValue("2025-01-01");
    await wrapper.find("#final-report-period").setValue("2025-01-31");
    await wrapper.find("#payment-concept").setValue("Servicios legales");
    await wrapper.find('input[aria-describedby="payment-currency"]').setValue("5000000");
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeUndefined();
  });

  test("save button stays disabled when paymentConcept is only whitespace", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    await wrapper.find("#document-number").setValue("CT-001");
    await wrapper.find("#initial-report-period").setValue("2025-01-01");
    await wrapper.find("#final-report-period").setValue("2025-01-31");
    await wrapper.find("#payment-concept").setValue("   ");
    await wrapper.find('input[aria-describedby="payment-currency"]').setValue("5000000");
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();
  });

  test("save button stays disabled when paymentAmount is NaN", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    await wrapper.find("#document-number").setValue("CT-001");
    await wrapper.find("#initial-report-period").setValue("2025-01-01");
    await wrapper.find("#final-report-period").setValue("2025-01-31");
    await wrapper.find("#payment-concept").setValue("Concepto");
    await wrapper.find('input[aria-describedby="payment-currency"]').setValue("abc");
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();
  });

  // quality: disable too_many_assertions (verifying complete submit flow: store call, notifications, navigation, form reset)
  test("successful submit calls createReportRequest, shows success notification, resets form and navigates", async () => {
    const intranetStore = useIntranetGymStore();
    let capturedArgs = null;
    jest
      .spyOn(intranetStore, "createReportRequest")
      .mockImplementation((formData) => {
        capturedArgs = { ...formData };
        return Promise.resolve(201);
      });

    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    await wrapper.find("#document-number").setValue("CT-001");
    await wrapper.find("#initial-report-period").setValue("2025-01-01");
    await wrapper.find("#final-report-period").setValue("2025-01-31");
    await wrapper.find("#payment-concept").setValue("Servicios legales");
    await wrapper.find('input[aria-describedby="payment-currency"]').setValue("5000000");
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowLoading).toHaveBeenCalled();
    expect(capturedArgs).toEqual(
      expect.objectContaining({
        document: "CT-001",
        initialDate: "2025-01-01",
        endDate: "2025-01-31",
        paymentConcept: "Servicios legales",
        paymentAmount: "5000000",
      })
    );
    expect(mockHideLoading).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Solicitud creada exitosamente!",
      "success"
    );
    expect(wrapper.emitted("close")).toBeTruthy();
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "dashboard" });

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    expect(wrapper.find("#document-number").element.value).toBe("");
    expect(wrapper.find("#payment-concept").element.value).toBe("");
  });

  test("submit with non-201 status shows error notification", async () => {
    const intranetStore = useIntranetGymStore();
    jest.spyOn(intranetStore, "createReportRequest").mockResolvedValue(400);

    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    await wrapper.find("#document-number").setValue("CT-001");
    await wrapper.find("#initial-report-period").setValue("2025-01-01");
    await wrapper.find("#final-report-period").setValue("2025-01-31");
    await wrapper.find("#payment-concept").setValue("Concepto");
    await wrapper.find('input[aria-describedby="payment-currency"]').setValue("1000");
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al crear la solicitud. Intenta nuevamente.",
      "error"
    );
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  test("submit exception shows unexpected error notification", async () => {
    const intranetStore = useIntranetGymStore();
    jest
      .spyOn(intranetStore, "createReportRequest")
      .mockRejectedValue(new Error("Network error"));

    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    await wrapper.find("#document-number").setValue("CT-001");
    await wrapper.find("#initial-report-period").setValue("2025-01-01");
    await wrapper.find("#final-report-period").setValue("2025-01-31");
    await wrapper.find("#payment-concept").setValue("Concepto");
    await wrapper.find('input[aria-describedby="payment-currency"]').setValue("1000");
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Hubo un error inesperado. Por favor, inténtalo más tarde.",
      "error"
    );
  });

  test("close button emits close event", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (structural selector for close icon without data-testid)
    const closeIcon = wrapper.find(".cursor-pointer");
    expect(closeIcon.exists()).toBe(true);

    await closeIcon.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("file upload via input adds file to list", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    const fileInput = wrapper.find("#file-upload"); // quality: allow-fragile-selector (stable DOM id)
    const pdfFile = new File(["content"], "document.pdf", { type: "application/pdf" });

    Object.defineProperty(fileInput.element, "files", {
      value: [pdfFile],
      configurable: true,
    });

    await fileInput.trigger("change");
    await flushPromises();

    expect(wrapper.text()).toContain("document.pdf");
  });

  test("unsupported file type shows warning notification", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    const fileInput = wrapper.find("#file-upload"); // quality: allow-fragile-selector (stable DOM id)
    const badFile = new File(["x"], "script.exe", { type: "application/x-msdownload" });

    Object.defineProperty(fileInput.element, "files", {
      value: [badFile],
      configurable: true,
    });

    await fileInput.trigger("change");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("no es compatible"),
      "warning"
    );
  });

  test("file exceeding 20MB shows warning notification", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    const fileInput = wrapper.find("#file-upload"); // quality: allow-fragile-selector (stable DOM id)
    const bigFile = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 21 * 1024 * 1024 });
    Object.defineProperty(bigFile, "name", { value: "large.pdf" });

    Object.defineProperty(fileInput.element, "files", {
      value: [bigFile],
      configurable: true,
    });

    await fileInput.trigger("change");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("excede el límite de 20 MB"),
      "warning"
    );
  });

  test("drag and drop adds valid files", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (structural selector for drop zone without data-testid)
    const dropZone = wrapper.find(".border-dashed");
    const jpgFile = new File(["img"], "photo.jpg", { type: "image/jpeg" });

    await dropZone.trigger("drop", {
      dataTransfer: { files: [jpgFile] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("photo.jpg");
  });

  test("remove file button removes file from list", async () => {
    const wrapper = mountForm(pinia);
    await flushPromises();

    const fileInput = wrapper.find("#file-upload"); // quality: allow-fragile-selector (stable DOM id)
    const pdfFile = new File(["content"], "doc.pdf", { type: "application/pdf" });

    Object.defineProperty(fileInput.element, "files", {
      value: [pdfFile],
      configurable: true,
    });

    await fileInput.trigger("change");
    await flushPromises();

    expect(wrapper.text()).toContain("doc.pdf");

    // quality: allow-fragile-selector (structural selector for file card without data-testid)
    const fileContainer = wrapper.find(".relative.p-4");
    await fileContainer.trigger("mouseenter");
    await flushPromises();

    // quality: allow-fragile-selector (structural selector for remove button without data-testid)
    const removeBtn = fileContainer.find(".absolute");
    await removeBtn.trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("doc.pdf");
  });
});
