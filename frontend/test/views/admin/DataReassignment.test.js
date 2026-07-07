import { ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockShowNotification = jest.fn();
jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

const mockFetchSummary = jest.fn();
const mockExecute = jest.fn();
const mockUnarchive = jest.fn();
// Real refs so the component's computed(() => store.summary) stays reactive.
const mockSummaryState = ref(null);
const mockExecutingState = ref(false);

jest.mock("@/stores/admin_reassignment", () => ({
  __esModule: true,
  useAdminReassignmentStore: () => ({
    get summary() { return mockSummaryState.value; },
    set summary(v) { mockSummaryState.value = v; },
    get executing() { return mockExecutingState.value; },
    loadingSummary: false,
    error: null,
    fetchSummary: (...a) => mockFetchSummary(...a),
    executeReassignment: (...a) => mockExecute(...a),
    unarchiveLawyer: (...a) => mockUnarchive(...a),
  }),
}));

import DataReassignment from "@/views/admin/DataReassignment.vue";
import { useUserStore } from "@/stores/auth/user";

const LAWYERS = [
  { id: 1, first_name: "Ana", last_name: "Uno", role: "lawyer" },
  { id: 2, first_name: "Beto", last_name: "Dos", role: "lawyer" },
  { id: 3, first_name: "Cyn", last_name: "Tres", role: "lawyer", is_archived: true },
];

const SUMMARY = {
  lawyer: { id: 1, full_name: "Ana Uno" },
  processes: [{ id: 10, ref: "P-10", plaintiff: "X", defendant: "Y", case_type: "Civil", clients_count: 1 }],
  eligible_documents: [{ id: 20, title: "Doc A", state: "Progress", assigned_to_name: null }],
  ineligible_documents: [{ id: 21, title: "Doc B", state: "PendingSignatures", reason: "En proceso de firma" }],
  counts: { processes: 1, eligible_documents: 1, ineligible_documents: 1 },
};

function mountView() {
  return mount(DataReassignment, {
    global: {
      stubs: {
        ConfirmationModal: {
          template: "<div data-testid='confirm-modal' v-if='visible'><button data-testid='confirm-yes' @click=\"$emit('confirm')\">ok</button></div>",
          props: ["visible", "title", "message", "confirmText", "isLoading"],
        },
      },
    },
  });
}

describe("DataReassignment.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockSummaryState.value = null;
    mockExecutingState.value = false;
    const store = useUserStore();
    store.$patch({ users: LAWYERS });
    mockFetchSummary.mockImplementation(async () => {
      mockSummaryState.value = SUMMARY;
      return SUMMARY;
    });
  });

  test("target options exclude the selected source and archived lawyers", async () => {
    const wrapper = mountView();
    await wrapper.find("[data-testid='source-lawyer-select']").setValue("1");
    await flushPromises();

    const targetOptions = wrapper
      .find("[data-testid='target-lawyer-select']")
      .findAll("option")
      .map((o) => o.element.value)
      .filter((v) => v);
    // Source (1) and archived (3) excluded → only 2 remains
    expect(targetOptions).toEqual(["2"]);
  });

  test("selecting a source fetches and renders the preview with ineligible reason", async () => {
    const wrapper = mountView();
    await wrapper.find("[data-testid='source-lawyer-select']").setValue("1");
    await flushPromises();

    expect(mockFetchSummary).toHaveBeenCalledWith(1);
    expect(wrapper.find("[data-testid='ineligible-documents']").text()).toContain(
      "En proceso de firma"
    );
    // Ineligible doc has no checkbox
    expect(wrapper.find("[data-testid='document-checkbox-21']").exists()).toBe(false);
  });

  test("select-all only picks eligible documents and enables the button", async () => {
    const wrapper = mountView();
    await wrapper.find("[data-testid='source-lawyer-select']").setValue("1");
    await flushPromises();
    await wrapper.find("[data-testid='target-lawyer-select']").setValue("2");

    await wrapper.find("[data-testid='select-all-documents']").setValue(true);
    await wrapper.find("[data-testid='select-all-processes']").setValue(true);

    expect(wrapper.find("[data-testid='reassign-button']").attributes("disabled")).toBeUndefined();

    mockExecute.mockResolvedValue({
      transferred_processes: 1,
      transferred_documents: 1,
      source_archived: false,
      source: { id: 1, full_name: "Ana Uno" },
      target: { id: 2, full_name: "Beto Dos" },
    });

    await wrapper.find("[data-testid='reassign-button']").trigger("click");
    await wrapper.find("[data-testid='confirm-yes']").trigger("click");
    await flushPromises();

    expect(mockExecute).toHaveBeenCalledWith({
      sourceLawyerId: 1,
      targetLawyerId: 2,
      processIds: [10],
      documentIds: [20],
      archiveSource: false,
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Se transfirieron 1 procesos y 1 documentos"),
      "success"
    );
  });

  test("archived lawyers can be restored", async () => {
    mockUnarchive.mockResolvedValue({});
    const wrapper = mountView();

    await wrapper.find("[data-testid='restore-lawyer-3']").trigger("click");
    await flushPromises();

    expect(mockUnarchive).toHaveBeenCalledWith(3);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("restaurado"),
      "success"
    );
  });
});
