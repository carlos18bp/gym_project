import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockFetch = jest.fn();
const mockAccept = jest.fn();
const mockReject = jest.fn();
const mockDownload = jest.fn();

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => ({
    fetchPaymentRecords: mockFetch,
    acceptPaymentRecord: mockAccept,
    rejectPaymentRecord: mockReject,
    downloadPaymentRecordFile: mockDownload,
  }),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: jest.fn().mockResolvedValue(undefined),
}));

import PaymentRecordsModal from "@/components/dynamic_document/cards/modals/PaymentRecordsModal.vue";

const DOCUMENT = { id: 7, title: "Contrato X" };

const buildPayload = (overrides = {}) => ({
  document_id: 7,
  configured: true,
  total_installments: 3,
  accepted_count: 1,
  total_amount_accepted: "4000000",
  in_review: false,
  next_uploadable: 2,
  can_review: false,
  can_upload: true,
  slots: [
    {
      installment_number: 1,
      status: "accepted",
      record: {
        id: 31,
        amount: "4000000",
        notes: "",
        original_name: "cuota1.pdf",
        rejection_reason: null,
        uploaded_at: "2026-07-01T10:00:00Z",
        uploaded_by_name: "Carlos Cliente",
      },
    },
    { installment_number: 2, status: "pending", record: null },
    { installment_number: 3, status: "pending", record: null },
  ],
  ...overrides,
});

async function mountModal(payload) {
  mockFetch.mockResolvedValue(payload);
  const wrapper = mount(PaymentRecordsModal, {
    props: { isVisible: false, document: DOCUMENT },
  });
  await wrapper.setProps({ isVisible: true });
  await flushPromises();
  return wrapper;
}

describe("PaymentRecordsModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  test("fetches on open and renders slots with progress", async () => {
    const wrapper = await mountModal(buildPayload());

    expect(mockFetch).toHaveBeenCalledWith(7);
    expect(wrapper.text()).toContain("1/3 cuotas aceptadas");
    expect(wrapper.text()).toContain("Cuota 1 de 3");
    expect(wrapper.text()).toContain("Aceptada");
    expect(wrapper.find('[data-testid="payment-slot-3"]').text()).toContain("Pendiente");
  });

  test("shows review buttons only when can_review and slot is uploaded", async () => {
    const payload = buildPayload({
      can_review: true,
      slots: [
        {
          installment_number: 1,
          status: "uploaded",
          record: {
            id: 31,
            amount: null,
            notes: "",
            original_name: "cuota1.pdf",
            rejection_reason: null,
            uploaded_at: "2026-07-01T10:00:00Z",
            uploaded_by_name: "Carlos Cliente",
          },
        },
        { installment_number: 2, status: "pending", record: null },
        { installment_number: 3, status: "pending", record: null },
      ],
    });
    const wrapper = await mountModal(payload);

    expect(wrapper.find('[data-testid="accept-payment-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reject-payment-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="accept-payment-2"]').exists()).toBe(false);
  });

  test("hides review buttons for non reviewers", async () => {
    const wrapper = await mountModal(buildPayload());

    expect(wrapper.find('[data-testid="accept-payment-1"]').exists()).toBe(false);
  });

  test("reject confirmation stays disabled until a reason is typed", async () => {
    const payload = buildPayload({
      can_review: true,
      slots: [
        {
          installment_number: 1,
          status: "uploaded",
          record: {
            id: 31,
            amount: null,
            notes: "",
            original_name: "cuota1.pdf",
            rejection_reason: null,
            uploaded_at: "2026-07-01T10:00:00Z",
            uploaded_by_name: "Carlos Cliente",
          },
        },
      ],
      total_installments: 1,
    });
    const wrapper = await mountModal(payload);

    await wrapper.find('[data-testid="reject-payment-1"]').trigger("click");
    const confirmButton = wrapper.find('[data-testid="confirm-reject-payment"]');
    expect(confirmButton.attributes("disabled")).toBeDefined();

    await wrapper.find('[data-testid="reject-reason-input"]').setValue("Ilegible");
    expect(confirmButton.attributes("disabled")).toBeUndefined();

    mockReject.mockResolvedValue(buildPayload());
    await confirmButton.trigger("click");
    await flushPromises();

    expect(mockReject).toHaveBeenCalledWith(7, 31, "Ilegible");
    expect(wrapper.emitted("updated")).toBeTruthy();
  });

  test("shows the previous rejection hint on re-uploaded records", async () => {
    const payload = buildPayload({
      can_review: true,
      slots: [
        {
          installment_number: 1,
          status: "uploaded",
          record: {
            id: 31,
            amount: null,
            notes: "",
            original_name: "cuota1.pdf",
            rejection_reason: "Faltaba el concepto",
            uploaded_at: "2026-07-01T10:00:00Z",
            uploaded_by_name: "Carlos Cliente",
          },
        },
      ],
      total_installments: 1,
    });
    const wrapper = await mountModal(payload);

    expect(wrapper.text()).toContain("Rechazo anterior: Faltaba el concepto");
  });

  test("emits upload-requested with the next uploadable slot", async () => {
    const wrapper = await mountModal(buildPayload());

    await wrapper.find('[data-testid="upload-from-detail"]').trigger("click");

    expect(wrapper.emitted("upload-requested")[0]).toEqual([2]);
  });

  test("accept refreshes the payload from the response", async () => {
    const payload = buildPayload({
      can_review: true,
      slots: [
        {
          installment_number: 1,
          status: "uploaded",
          record: {
            id: 31,
            amount: null,
            notes: "",
            original_name: "cuota1.pdf",
            rejection_reason: null,
            uploaded_at: "2026-07-01T10:00:00Z",
            uploaded_by_name: "Carlos Cliente",
          },
        },
      ],
      total_installments: 1,
    });
    const wrapper = await mountModal(payload);
    mockAccept.mockResolvedValue(
      buildPayload({ accepted_count: 3, total_installments: 1, slots: [] })
    );

    await wrapper.find('[data-testid="accept-payment-1"]').trigger("click");
    await flushPromises();

    expect(mockAccept).toHaveBeenCalledWith(7, 31);
    expect(wrapper.emitted("updated")).toBeTruthy();
  });

  test("download delegates to the store with the original filename", async () => {
    const wrapper = await mountModal(buildPayload());

    await wrapper.find('[data-testid="download-payment-1"]').trigger("click");

    expect(mockDownload).toHaveBeenCalledWith(7, 31, "cuota1.pdf");
  });
});
