import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import SendDocumentModal from "@/components/dynamic_document/cards/modals/SendDocumentModal.vue";

const mockShowNotification = jest.fn();
const mockSendEmail = jest.fn().mockResolvedValue({});
const mockGetRequest = jest.fn().mockResolvedValue({ data: new Blob(["pdf"]) });

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/composables/useSendEmail", () => ({
  __esModule: true,
  useSendEmail: () => ({ sendEmail: mockSendEmail }),
}));

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const Stub = { name: "IconStub", template: "<span />" };
  return {
    __esModule: true,
    XMarkIcon: Stub,
    CloudArrowUpIcon: Stub,
    PhotoIcon: Stub,
    DocumentIcon: Stub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function mountModal(pinia, props = {}) {
  return mount(SendDocumentModal, {
    props: {
      document: { id: 1, title: "Test Document" },
      ...props,
    },
    global: { plugins: [pinia] },
  });
}

describe("SendDocumentModal.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders email input and send button", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    expect(wrapper.find("#email").exists()).toBe(true);
    expect(wrapper.text()).toContain("Correo electrónico");

    const sendBtn = wrapper.find('button[type="submit"]');
    expect(sendBtn.exists()).toBe(true);
    expect(sendBtn.text()).toContain("Enviar");
  });

  test("send button is disabled when email is empty", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const sendBtn = wrapper.find('button[type="submit"]');
    expect(sendBtn.attributes("disabled")).toBeDefined();
  });

  test("send button is disabled when email is invalid", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#email").setValue("not-an-email"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const sendBtn = wrapper.find('button[type="submit"]');
    expect(sendBtn.attributes("disabled")).toBeDefined();
  });

  test("send button is enabled when email is valid", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#email").setValue("user@example.com"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const sendBtn = wrapper.find('button[type="submit"]');
    expect(sendBtn.attributes("disabled")).toBeUndefined();
  });

  test("close button emits close and resets form", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#email").setValue("user@example.com"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const closeBtn = wrapper.findAll("button").find(
      (b) => b.findComponent({ name: "IconStub" }).exists() && !b.attributes("type")
    );
    await closeBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("clicking overlay emits close", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (structural selector for modal overlay without data-testid)
    await wrapper.find(".fixed.inset-0").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("file upload via input adds file to list", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const fileInput = wrapper.find("#file-upload"); // quality: allow-fragile-selector (stable DOM id)
    const pdfFile = new File(["content"], "report.pdf", { type: "application/pdf" });

    Object.defineProperty(fileInput.element, "files", {
      value: [pdfFile],
      configurable: true,
    });

    await fileInput.trigger("change");
    await flushPromises();

    expect(wrapper.text()).toContain("report.pdf");
  });

  test("unsupported file type shows warning", async () => {
    const wrapper = mountModal(pinia);
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
      expect.stringContaining("Unsupported file type"),
      "warning"
    );
  });

  test("file exceeding 20MB shows warning", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const fileInput = wrapper.find("#file-upload"); // quality: allow-fragile-selector (stable DOM id)
    const bigFile = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 21 * 1024 * 1024 });

    Object.defineProperty(fileInput.element, "files", {
      value: [bigFile],
      configurable: true,
    });

    await fileInput.trigger("change");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("exceeds the 20 MB limit"),
      "warning"
    );
  });

  test("drag and drop adds valid files", async () => {
    const wrapper = mountModal(pinia);
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

  test("submit calls sendEmail with correct params and closes modal", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#email").setValue("user@example.com"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockSendEmail).toHaveBeenCalledWith(
      "dynamic-documents/send_email_with_attachments/",
      "user@example.com",
      "Test Document",
      expect.any(String),
      expect.any(Array),
      { documentId: 1 }
    );

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("file upload area shows drag-and-drop text when no files", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("Sube un archivo");
    expect(wrapper.text()).toContain("o arrastra y suelta");
  });

  test("remove file removes it from the list", async () => {
    const wrapper = mountModal(pinia);
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
