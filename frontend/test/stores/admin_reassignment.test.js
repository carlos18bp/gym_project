import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useAdminReassignmentStore } from "@/stores/admin_reassignment";

const mockFetchUsersData = jest.fn();
jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => ({ fetchUsersData: mockFetchUsersData }),
}));

const mock = new AxiosMockAdapter(axios);

describe("Admin Reassignment Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("fetchSummary loads the preview and stores it", async () => {
    const payload = { lawyer: { id: 3 }, processes: [], counts: {} };
    mock.onGet("/api/admin/reassignment/summary/?lawyer_id=3").reply(200, payload);
    const store = useAdminReassignmentStore();

    const data = await store.fetchSummary(3);

    expect(data).toEqual(payload);
    expect(store.summary).toEqual(payload);
    expect(store.loadingSummary).toBe(false);
  });

  test("fetchSummary surfaces the backend detail on error", async () => {
    mock.onGet("/api/admin/reassignment/summary/?lawyer_id=9").reply(404, {
      detail: "Abogado no encontrado.",
    });
    const store = useAdminReassignmentStore();

    await expect(store.fetchSummary(9)).rejects.toBeTruthy();
    expect(store.error).toBe("Abogado no encontrado.");
  });

  test("fetchSummary falls back to a generic error without backend detail", async () => {
    mock.onGet("/api/admin/reassignment/summary/?lawyer_id=9").networkError();
    const store = useAdminReassignmentStore();

    await expect(store.fetchSummary(9)).rejects.toBeTruthy();
    expect(store.error).toBe("No se pudo cargar el resumen.");
  });

  test("executeReassignment sends snake_case payload and refreshes users", async () => {
    const result = { transferred_processes: 1, transferred_documents: 2, source_archived: true };
    mock.onPost("/api/admin/reassignment/execute/").reply(200, result);
    const store = useAdminReassignmentStore();

    const data = await store.executeReassignment({
      sourceLawyerId: 3,
      targetLawyerId: 5,
      processIds: [10],
      documentIds: [20, 21],
      archiveSource: true,
    });

    expect(data).toEqual(result);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      source_lawyer_id: 3,
      target_lawyer_id: 5,
      process_ids: [10],
      document_ids: [20, 21],
      archive_source: true,
    });
    expect(mockFetchUsersData).toHaveBeenCalled();
  });

  test("executeReassignment surfaces the backend detail on error", async () => {
    mock.onPost("/api/admin/reassignment/execute/").reply(400, {
      detail: "El abogado destino está archivado.",
    });
    const store = useAdminReassignmentStore();

    await expect(
      store.executeReassignment({
        sourceLawyerId: 3,
        targetLawyerId: 5,
        processIds: [],
        documentIds: [20],
        archiveSource: false,
      })
    ).rejects.toBeTruthy();

    expect(store.error).toBe("El abogado destino está archivado.");
    expect(store.executing).toBe(false);
  });

  test("executeReassignment falls back to a generic error without backend detail", async () => {
    mock.onPost("/api/admin/reassignment/execute/").networkError();
    const store = useAdminReassignmentStore();

    await expect(
      store.executeReassignment({
        sourceLawyerId: 3,
        targetLawyerId: 5,
        processIds: [1],
        documentIds: [],
        archiveSource: false,
      })
    ).rejects.toBeTruthy();

    expect(store.error).toBe("No se pudo completar la reasignación.");
  });

  test("archiveLawyer and unarchiveLawyer hit their endpoints and refresh users", async () => {
    mock.onPost("/api/admin/lawyers/3/archive/").reply(200, { id: 3, is_archived: true });
    mock.onPost("/api/admin/lawyers/3/unarchive/").reply(200, { id: 3, is_archived: false });
    const store = useAdminReassignmentStore();

    const archived = await store.archiveLawyer(3);
    expect(archived.is_archived).toBe(true);

    const restored = await store.unarchiveLawyer(3);
    expect(restored.is_archived).toBe(false);

    expect(mockFetchUsersData).toHaveBeenCalledTimes(2);
  });
});
