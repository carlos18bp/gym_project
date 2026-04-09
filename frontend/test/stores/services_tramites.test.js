const mockGetRequest = jest.fn();
const mockCreateRequest = jest.fn();
const mockUpdateRequest = jest.fn();

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
  create_request: (...args) => mockCreateRequest(...args),
  update_request: (...args) => mockUpdateRequest(...args),
}));

import { setActivePinia, createPinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

describe("services_tramites store", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
  });

  // ─── fetchFeaturedServices ──────────────────────────────────────────────

  test("fetchFeaturedServices calls GET services/featured/ and sets state", async () => {
    const services = [{ id: 1, name: "Registro" }];
    mockGetRequest.mockResolvedValueOnce({ data: { services } });

    const result = await store.fetchFeaturedServices();

    expect(mockGetRequest).toHaveBeenCalledWith("services/featured/");
    expect(store.featuredServices).toEqual(services);
    expect(result).toEqual(services);
  });

  // ─── fetchServices ─────────────────────────────────────────────────────

  test("fetchServices calls GET services/ and sets state", async () => {
    const services = [{ id: 1, name: "Registro" }, { id: 2, name: "Consulta" }];
    mockGetRequest.mockResolvedValueOnce({ data: { services } });

    const result = await store.fetchServices();

    expect(mockGetRequest).toHaveBeenCalledWith("services/");
    expect(store.services).toEqual(services);
    expect(result).toEqual(services);
  });

  test("fetchServices passes include_inactive param when requested", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { services: [] } });

    await store.fetchServices({ include_inactive: true });

    expect(mockGetRequest).toHaveBeenCalledWith("services/?include_inactive=1");
  });

  // ─── fetchServiceDetail ────────────────────────────────────────────────

  test("fetchServiceDetail calls GET services/{id}/ and sets selectedService", async () => {
    const service = { id: 5, name: "Servicio" };
    const draft = { id: 10, status: "DRAFT" };
    mockGetRequest.mockResolvedValueOnce({ data: { service, draft } });

    const result = await store.fetchServiceDetail(5);

    expect(mockGetRequest).toHaveBeenCalledWith("services/5/");
    expect(store.selectedService).toEqual(service);
    expect(store.selectedDraft).toEqual(draft);
    expect(result).toEqual({ service, draft });
  });

  // ─── saveServiceRequest ────────────────────────────────────────────────

  test("saveServiceRequest posts FormData with payload and files", async () => {
    const responseData = { id: 1, tracking_number: "2026-00001", status: "OPEN" };
    mockCreateRequest.mockResolvedValueOnce({ data: responseData });

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    const result = await store.saveServiceRequest({
      serviceId: 1,
      requestId: null,
      answers: [{ field_id: 100, value_text: "Test" }],
      currentStage: 1,
      isSubmit: true,
      filesByField: { 101: [file] },
    });

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    const [url, formData] = mockCreateRequest.mock.calls[0];
    expect(url).toBe("service-requests/save/");
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("payload")).toBeTruthy();
    expect(formData.get("field_files_101")).toBe(file);
    expect(result).toEqual(responseData);
  });

  // ─── fetchMyRequests ───────────────────────────────────────────────────

  test("fetchMyRequests passes filter query params", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { results: [], count: 0 } });

    await store.fetchMyRequests({ status: "OPEN", tracking: "2026" });

    expect(mockGetRequest).toHaveBeenCalledWith(
      "service-requests/my/?status=OPEN&tracking=2026"
    );
  });

  // ─── fetchInboxRequests ────────────────────────────────────────────────

  test("fetchInboxRequests passes search and date filters", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { results: [], count: 0 } });

    await store.fetchInboxRequests({ search: "juan", date_from: "2026-01-01" });

    expect(mockGetRequest).toHaveBeenCalledWith(
      "service-requests/inbox/?search=juan&date_from=2026-01-01"
    );
  });

  // ─── manageRequest ─────────────────────────────────────────────────────

  test("manageRequest posts status and message as FormData", async () => {
    const responseData = { id: 1, status: "IN_STUDY" };
    mockCreateRequest.mockResolvedValueOnce({ data: responseData });

    const result = await store.manageRequest(1, {
      status: "IN_STUDY",
      message: "Revisando",
    });

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    const [url, formData] = mockCreateRequest.mock.calls[0];
    expect(url).toBe("service-requests/1/manage/");
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("status")).toBe("IN_STUDY");
    expect(formData.get("message")).toBe("Revisando");
    expect(result).toEqual(responseData);
  });

  // ─── downloadRequestDocument ───────────────────────────────────────────

  test("downloadRequestDocument uses arraybuffer responseType", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: new ArrayBuffer(8) });

    await store.downloadRequestDocument(42);

    expect(mockGetRequest).toHaveBeenCalledWith(
      "service-requests/42/document/download/",
      "arraybuffer"
    );
  });

  // ─── createService ─────────────────────────────────────────────────────

  test("createService sends multipart with icon file", async () => {
    mockCreateRequest.mockResolvedValueOnce({ data: { id: 10, name: "Nuevo" } });

    const iconFile = new File(["img"], "icon.png", { type: "image/png" });
    const payload = { name: "Nuevo", short_title: "N", slug: "nuevo", stages: [] };

    await store.createService(payload, iconFile);

    const [url, formData] = mockCreateRequest.mock.calls[0];
    expect(url).toBe("services/admin/create/");
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("icon_image")).toBe(iconFile);
    expect(JSON.parse(formData.get("payload"))).toEqual(payload);
  });

  // ─── toggleServiceActive ───────────────────────────────────────────────

  test("toggleServiceActive posts to toggle endpoint", async () => {
    mockCreateRequest.mockResolvedValueOnce({ data: { id: 1, is_active: false } });

    const result = await store.toggleServiceActive(1);

    expect(mockCreateRequest).toHaveBeenCalledWith(
      "services/admin/1/toggle-active/",
      {}
    );
    expect(result).toEqual({ id: 1, is_active: false });
  });

  // ─── toggleServiceFeatured ─────────────────────────────────────────────

  test("toggleServiceFeatured posts to toggle endpoint", async () => {
    mockCreateRequest.mockResolvedValueOnce({ data: { id: 1, is_featured: true } });

    const result = await store.toggleServiceFeatured(1);

    expect(mockCreateRequest).toHaveBeenCalledWith(
      "services/admin/1/toggle-featured/",
      {}
    );
    expect(result).toEqual({ id: 1, is_featured: true });
  });

  // ─── fetchLatestDraft ──────────────────────────────────────────────────

  test("fetchLatestDraft calls GET service-requests/service/{id}/draft/ and sets selectedDraft", async () => {
    const draft = { id: 7, status: "DRAFT" };
    mockGetRequest.mockResolvedValueOnce({ data: { draft } });

    const result = await store.fetchLatestDraft(3);

    expect(mockGetRequest).toHaveBeenCalledWith("service-requests/service/3/draft/");
    expect(store.selectedDraft).toEqual(draft);
    expect(result).toEqual(draft);
  });

  // ─── downloadFieldFile ─────────────────────────────────────────────────

  test("downloadFieldFile uses arraybuffer responseType with correct URL", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: new ArrayBuffer(4) });

    await store.downloadFieldFile(10, 55);

    expect(mockGetRequest).toHaveBeenCalledWith(
      "service-requests/10/field-files/55/download/",
      "arraybuffer"
    );
  });

  // ─── downloadResponseFile ──────────────────────────────────────────────

  test("downloadResponseFile uses arraybuffer responseType with correct URL", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: new ArrayBuffer(4) });

    await store.downloadResponseFile(10, 20, 55);

    expect(mockGetRequest).toHaveBeenCalledWith(
      "service-requests/10/responses/20/files/55/download/",
      "arraybuffer"
    );
  });

  // ─── fetchAdminServices ────────────────────────────────────────────────

  test("fetchAdminServices calls GET services/admin/list/ and sets adminServices", async () => {
    const services = [{ id: 1, name: "Registro Civil" }];
    mockGetRequest.mockResolvedValueOnce({ data: { services } });

    const result = await store.fetchAdminServices();

    expect(mockGetRequest).toHaveBeenCalledWith("services/admin/list/");
    expect(store.adminServices).toEqual(services);
    expect(result).toEqual(services);
  });

  // ─── updateService ─────────────────────────────────────────────────────

  test("updateService sends FormData with payload and icon to update endpoint", async () => {
    const responseData = { id: 5, name: "Actualizado" };
    mockUpdateRequest.mockResolvedValueOnce({ data: responseData });

    const iconFile = new File(["img"], "icon.png", { type: "image/png" });
    const payload = { name: "Actualizado", short_title: "A", stages: [] };

    const result = await store.updateService(5, payload, iconFile);

    const [url, formData] = mockUpdateRequest.mock.calls[0];
    expect(url).toBe("services/admin/5/update/");
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("icon_image")).toBe(iconFile);
    expect(JSON.parse(formData.get("payload"))).toEqual(payload);
    expect(result).toEqual(responseData);
  });
});
