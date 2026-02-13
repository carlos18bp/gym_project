import { mount } from "@vue/test-utils";

import LegalRequestsList from "@/components/legal-requests/LegalRequestsList.vue";

const mockFetchRequests = jest.fn();
let mockStore;

jest.mock("@/stores/legal/legal_requests_management.js", () => ({
  __esModule: true,
  useLegalRequestsStore: () => mockStore,
}));

jest.mock("@/stores/auth/auth.js", () => ({
  __esModule: true,
  useAuthStore: () => ({ user: { role: "lawyer" } }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  DocumentTextIcon: { template: "<span />" },
  MagnifyingGlassIcon: { template: "<span />" },
}));

const LegalRequestCardStub = {
  name: "LegalRequestCard",
  props: ["request"],
  template: `
    <div data-test="request-card">
      <span data-test="status">{{ request.status }}</span>
      <button data-test="status-btn" @click="$emit('status-updated', { ...request, status: 'RESPONDED' })">status</button>
      <button data-test="delete-btn" @click="$emit('deleted', request.id)">delete</button>
    </div>
  `,
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("LegalRequestsList.vue", () => {
  beforeEach(() => {
    mockFetchRequests.mockReset();
    mockStore = { fetchRequests: mockFetchRequests };
  });

  test("fetches requests on mount and renders summary", async () => {
    mockFetchRequests.mockResolvedValueOnce({
      requests: [{ id: 1, status: "PENDING" }, { id: 2, status: "PENDING" }],
      count: 2,
      userRole: "lawyer",
    });

    const wrapper = mount(LegalRequestsList, {
      props: {
        userRole: "lawyer",
      },
      global: {
        stubs: {
          LegalRequestCard: LegalRequestCardStub,
        },
      },
    });

    await flushPromises();

    expect(mockFetchRequests).toHaveBeenCalledWith({
      page: 1,
      search: "",
      status: "",
      date_from: "",
      date_to: "",
    });

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(2);
    expect(wrapper.text()).toContain("Mostrando 2 de 2 solicitudes");
  });

  test("handles status updates and deletions", async () => {
    mockFetchRequests.mockResolvedValueOnce({
      requests: [{ id: 1, status: "PENDING" }, { id: 2, status: "PENDING" }],
      count: 2,
      userRole: "lawyer",
    });

    const wrapper = mount(LegalRequestsList, {
      props: {
        userRole: "lawyer",
      },
      global: {
        stubs: {
          LegalRequestCard: LegalRequestCardStub,
        },
      },
    });

    await flushPromises();

    await wrapper.findAll("[data-test='status-btn']")[0].trigger("click");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")[0].text()).toContain("RESPONDED");

    await wrapper.findAll("[data-test='delete-btn']")[0].trigger("click");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(1);
    expect(wrapper.text()).toContain("Mostrando 1 de 1 solicitudes");
  });

  test("clearFilters resets inputs and refetches", async () => {
    mockFetchRequests.mockResolvedValue({ requests: [], count: 0, userRole: "lawyer" });

    const wrapper = mount(LegalRequestsList, {
      props: {
        userRole: "lawyer",
      },
      global: {
        stubs: {
          LegalRequestCard: LegalRequestCardStub,
        },
      },
    });

    await flushPromises();

    const select = wrapper.find("select");
    const inputs = wrapper.findAll("input[type='date']");

    await select.setValue("PENDING");
    await inputs[0].setValue("2026-02-01");
    await inputs[1].setValue("2026-02-05");

    const clearButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Limpiar"));

    expect(clearButton).toBeTruthy();
    await clearButton.trigger("click");

    expect(select.element.value).toBe("");
    expect(inputs[0].element.value).toBe("");
    expect(inputs[1].element.value).toBe("");
    expect(mockFetchRequests).toHaveBeenLastCalledWith({
      page: 1,
      search: "",
      status: "",
      date_from: "",
      date_to: "",
    });
  });
});
