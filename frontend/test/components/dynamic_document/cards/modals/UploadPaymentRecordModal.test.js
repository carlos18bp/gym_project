import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockUpload = jest.fn();

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => ({
    uploadPaymentRecord: mockUpload,
  }),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: jest.fn().mockResolvedValue(undefined),
}));

import UploadPaymentRecordModal from "@/components/dynamic_document/cards/modals/UploadPaymentRecordModal.vue";
import { showNotification } from "@/shared/notification_message";

const DOCUMENT = { id: 7, title: "Contrato X", summary_payment_installments: 3 };

function mountModal() {
  return mount(UploadPaymentRecordModal, {
    props: { isVisible: true, document: DOCUMENT, slotNumber: 2 },
  });
}

async function selectFile(wrapper, file) {
  const input = wrapper.find('[data-testid="payment-file-input"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
}

describe("UploadPaymentRecordModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  test("shows the auto-selected slot", () => {
    const wrapper = mountModal();

    expect(wrapper.text()).toContain("Cuota 2 de 3");
  });

  test("rejects disallowed extensions", async () => {
    const wrapper = mountModal();

    await selectFile(wrapper, new File(["x"], "virus.exe", { type: "application/octet-stream" }));

    expect(wrapper.find('[data-testid="payment-file-error"]').text()).toContain(
      "Formato no permitido"
    );
    expect(wrapper.find('[data-testid="payment-submit"]').attributes("disabled")).toBeDefined();
  });

  test("rejects files above 20MB", async () => {
    const wrapper = mountModal();
    const bigFile = new File(["x"], "cuenta.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 21 * 1024 * 1024 });

    await selectFile(wrapper, bigFile);

    expect(wrapper.find('[data-testid="payment-file-error"]').text()).toContain("20 MB");
  });

  test("submits form data and emits uploaded", async () => {
    const wrapper = mountModal();
    const file = new File(["pdf"], "cuenta.pdf", { type: "application/pdf" });
    await selectFile(wrapper, file);

    await wrapper.find('[data-testid="payment-amount-input"]').setValue("2500000");
    await wrapper.find('[data-testid="payment-notes-input"]').setValue("Cuota corregida");

    const payload = { configured: true, slots: [] };
    mockUpload.mockResolvedValue(payload);

    await wrapper.find('[data-testid="payment-submit"]').trigger("click");
    await flushPromises();

    expect(mockUpload).toHaveBeenCalledWith(7, {
      file,
      installmentNumber: 2,
      // Vue casts v-model on type="number" inputs to Number; FormData
      // stringifies it again on the wire.
      amount: 2500000,
      notes: "Cuota corregida",
    });
    expect(wrapper.emitted("uploaded")[0]).toEqual([payload]);
  });

  test("shows the backend detail on upload errors", async () => {
    const wrapper = mountModal();
    await selectFile(wrapper, new File(["pdf"], "cuenta.pdf", { type: "application/pdf" }));

    mockUpload.mockRejectedValue({
      response: { data: { detail: "Hay una cuenta de cobro en revisión" } },
    });

    await wrapper.find('[data-testid="payment-submit"]').trigger("click");
    await flushPromises();

    expect(showNotification).toHaveBeenCalledWith(
      "Hay una cuenta de cobro en revisión",
      "error"
    );
    expect(wrapper.emitted("uploaded")).toBeFalsy();
  });

  test("resets state when the modal closes", async () => {
    const wrapper = mountModal();
    await selectFile(wrapper, new File(["pdf"], "cuenta.pdf", { type: "application/pdf" }));

    await wrapper.setProps({ isVisible: false });
    await wrapper.setProps({ isVisible: true });

    expect(wrapper.find('[data-testid="payment-submit"]').attributes("disabled")).toBeDefined();
  });
});
