import { setActivePinia, createPinia } from "pinia";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  downloadFile: jest.fn(),
}));

import { downloadFile } from "@/shared/document_utils";

const mock = new AxiosMockAdapter(axios);

const PAYLOAD = {
  document_id: 7,
  configured: true,
  total_installments: 3,
  accepted_count: 1,
  total_amount_accepted: "100.00",
  in_review: false,
  next_uploadable: 2,
  can_review: false,
  can_upload: true,
  slots: [],
};

describe("Dynamic Document Store - paymentRecords module", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("fetchPaymentRecords returns the payments payload", async () => {
    mock.onGet("/api/dynamic-documents/7/payment-records/").reply(200, PAYLOAD);
    const store = useDynamicDocumentStore();

    const data = await store.fetchPaymentRecords(7);

    expect(data).toEqual(PAYLOAD);
  });

  test("fetchPaymentRecords propagates API errors", async () => {
    mock.onGet("/api/dynamic-documents/7/payment-records/").reply(500);
    const store = useDynamicDocumentStore();

    await expect(store.fetchPaymentRecords(7)).rejects.toBeTruthy();
  });

  test("uploadPaymentRecord posts multipart form data with optional fields", async () => {
    mock
      .onPost("/api/dynamic-documents/7/payment-records/upload/")
      .reply(201, PAYLOAD);
    const store = useDynamicDocumentStore();
    const file = new File(["pdf"], "cuota1.pdf", { type: "application/pdf" });

    const data = await store.uploadPaymentRecord(7, {
      file,
      installmentNumber: 1,
      amount: "2500000",
      notes: "Primera cuota",
    });

    expect(data).toEqual(PAYLOAD);
    const request = mock.history.post[0];
    expect(request.data).toBeInstanceOf(FormData);
    expect(request.data.get("installment_number")).toBe("1");
    expect(request.data.get("amount")).toBe("2500000");
    expect(request.data.get("notes")).toBe("Primera cuota");
    expect(request.data.get("file")).toBe(file);
  });

  test("uploadPaymentRecord omits empty optional fields", async () => {
    mock
      .onPost("/api/dynamic-documents/7/payment-records/upload/")
      .reply(201, PAYLOAD);
    const store = useDynamicDocumentStore();
    const file = new File(["pdf"], "cuota1.pdf", { type: "application/pdf" });

    await store.uploadPaymentRecord(7, {
      file,
      installmentNumber: 1,
      amount: "",
      notes: "",
    });

    const request = mock.history.post[0];
    expect(request.data.has("amount")).toBe(false);
    expect(request.data.has("notes")).toBe(false);
  });

  test("acceptPaymentRecord posts to the accept endpoint", async () => {
    mock
      .onPost("/api/dynamic-documents/7/payment-records/34/accept/")
      .reply(200, PAYLOAD);
    const store = useDynamicDocumentStore();

    const data = await store.acceptPaymentRecord(7, 34);

    expect(data).toEqual(PAYLOAD);
  });

  test("rejectPaymentRecord sends the mandatory reason", async () => {
    mock
      .onPost("/api/dynamic-documents/7/payment-records/34/reject/")
      .reply(200, PAYLOAD);
    const store = useDynamicDocumentStore();

    await store.rejectPaymentRecord(7, 34, "Monto errado");

    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      rejection_reason: "Monto errado",
    });
  });

  test("downloadPaymentRecordFile delegates to downloadFile with mime by extension", async () => {
    const store = useDynamicDocumentStore();

    await store.downloadPaymentRecordFile(7, 34, "cuenta_cobro.pdf");

    expect(downloadFile).toHaveBeenCalledWith(
      "dynamic-documents/7/payment-records/34/download/",
      "cuenta_cobro.pdf",
      "application/pdf"
    );
  });
});
