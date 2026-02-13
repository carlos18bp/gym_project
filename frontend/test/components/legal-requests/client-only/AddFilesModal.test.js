import { mount } from "@vue/test-utils";

import AddFilesModal from "@/components/legal-requests/client-only/AddFilesModal.vue";

const mockAddFilesToRequest = jest.fn();
let mockLegalStore;

jest.mock("@/stores/legal/legal_requests_management.js", () => ({
  __esModule: true,
  useLegalRequestsStore: () => mockLegalStore,
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
  DocumentPlusIcon: { template: "<span />" },
}));

const buildRequest = (overrides = {}) => ({
  id: 1,
  request_number: "REQ-1",
  ...overrides,
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFile = (name, size, type) =>
  new File([new ArrayBuffer(size)], name, { type });

describe("AddFilesModal.vue", () => {
  beforeEach(() => {
    mockAddFilesToRequest.mockReset();
    mockLegalStore = {
      addFilesToRequest: mockAddFilesToRequest,
    };
  });

  test("selects files and uploads successfully", async () => {
    const file = createFile("document.pdf", 1024, "application/pdf");
    mockAddFilesToRequest.mockResolvedValue({ success: true });

    const wrapper = mount(AddFilesModal, {
      props: {
        request: buildRequest(),
      },
    });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");

    expect(wrapper.text()).toContain("document.pdf");

    const uploadButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Subir"));

    expect(uploadButton.attributes("disabled")).toBeUndefined();

    await uploadButton.trigger("click");
    await flushPromises();

    expect(mockAddFilesToRequest).toHaveBeenCalledWith(1, [file]);
    expect(wrapper.emitted("files-added")).toBeTruthy();
    expect(wrapper.text()).not.toContain("document.pdf");
  });

  test("filters invalid, oversized, and duplicate files", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    const invalidFile = createFile("malware.exe", 256, "application/x-msdownload");
    const largeFile = createFile("large.pdf", 11 * 1024 * 1024, "application/pdf");
    const validFile = createFile("ok.pdf", 1024, "application/pdf");

    const wrapper = mount(AddFilesModal, {
      props: {
        request: buildRequest(),
      },
    });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", {
      value: [invalidFile, largeFile, validFile, validFile],
    });
    await input.trigger("change");

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("no es un tipo permitido")
    );
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("demasiado grande")
    );
    const items = wrapper.findAll("div.bg-gray-50.rounded.text-sm");
    expect(items).toHaveLength(1);
    expect(wrapper.text()).toContain("ok.pdf");

    alertSpy.mockRestore();
  });

  test("removes selected file and emits close on backdrop click", async () => {
    const file = createFile("removable.pdf", 1024, "application/pdf");

    const wrapper = mount(AddFilesModal, {
      props: {
        request: buildRequest(),
      },
    });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");

    expect(wrapper.findAll("div.bg-gray-50.rounded.text-sm")).toHaveLength(1);

    await wrapper.find("button.text-red-500").trigger("click");

    expect(wrapper.findAll("div.bg-gray-50.rounded.text-sm")).toHaveLength(0);

    await wrapper.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("shows alert on upload failure and keeps selected files", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const file = createFile("fail.pdf", 1024, "application/pdf");

    mockAddFilesToRequest.mockRejectedValue(new Error("Boom"));

    const wrapper = mount(AddFilesModal, {
      props: {
        request: buildRequest(),
      },
    });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");

    const uploadButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Subir"));

    await uploadButton.trigger("click");
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error al subir archivos")
    );
    expect(wrapper.emitted("files-added")).toBeFalsy();
    expect(wrapper.findAll("div.bg-gray-50.rounded.text-sm")).toHaveLength(1);
    expect(wrapper.text()).toContain("fail.pdf");

    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
