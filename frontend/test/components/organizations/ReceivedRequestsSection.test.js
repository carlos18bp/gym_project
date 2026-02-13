import { mount } from "@vue/test-utils";

import ReceivedRequestsSection from "@/components/organizations/corporate_client/sections/ReceivedRequestsSection.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    ClipboardDocumentListIcon: IconStub,
    ArrowPathIcon: IconStub,
    InformationCircleIcon: IconStub,
    XMarkIcon: IconStub,
    ChevronLeftIcon: IconStub,
    ChevronRightIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const CorporateRequestCardStub = {
  name: "CorporateRequestCard",
  props: ["request"],
  template: `
    <div data-test="request-card">
      <span data-test="request-title">{{ request.title }}</span>
      <button type="button" data-test="view-detail" @click="$emit('view-detail', request.id)">Ver Detalle</button>
      <button type="button" data-test="status-updated" @click="$emit('status-updated', { requestId: request.id, newStatus: 'RESOLVED', request })">Status</button>
    </div>
  `,
};

const buildRequests = () => {
  return [
    {
      id: 1,
      title: "Old Pending",
      request_number: "CORP-REQ-1",
      description: "Desc",
      status: "PENDING",
      priority: "LOW",
      client_name: "Alice",
      organization_info: { id: 1, title: "Acme" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      title: "New In Review",
      request_number: "CORP-REQ-2",
      description: "Urgent",
      status: "IN_REVIEW",
      priority: "URGENT",
      client_name: "Bob",
      organization_info: { id: 2, title: "Beta" },
      created_at: "2026-02-01T00:00:00.000Z",
    },
    {
      id: 3,
      title: "Mid Responded",
      request_number: "CORP-REQ-3",
      description: "Something",
      status: "RESPONDED",
      priority: "HIGH",
      client_name: "Alice",
      organization_info: { id: 1, title: "Acme" },
      created_at: "2026-01-15T00:00:00.000Z",
    },
  ];
};

const buildManyRequests = (count) => {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return {
      id,
      title: `Request ${id}`,
      request_number: `REQ-${id}`,
      description: `Desc ${id}`,
      status: id % 2 === 0 ? "PENDING" : "IN_REVIEW",
      priority: id % 3 === 0 ? "URGENT" : "LOW",
      client_name: id <= 12 ? "Client A" : "Client B",
      organization_info: { id: 1, title: "Acme" },
      created_at: new Date(2026, 0, id).toISOString(),
    };
  });
};

describe("ReceivedRequestsSection.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders requests sorted by created_at (newest first) and quick stats match filteredRequests", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: buildRequests(),
        organizations: [
          { id: 1, title: "Acme" },
          { id: 2, title: "Beta" },
        ],
        isLoading: false,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    const titles = wrapper
      .findAll("[data-test='request-title']")
      .map((n) => (n.text() || "").trim());

    expect(titles).toEqual(["New In Review", "Mid Responded", "Old Pending"]);

    expect(wrapper.text()).toContain("Total:");
    expect(wrapper.text()).toContain("3");
    expect(wrapper.text()).toContain("Pendientes:");
    expect(wrapper.text()).toContain("1");
    expect(wrapper.text()).toContain("En Revisión:");
    expect(wrapper.text()).toContain("1");
    expect(wrapper.text()).toContain("Urgentes:");
    expect(wrapper.text()).toContain("1");
  });

  test("filters by status, priority, organization and search", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: buildRequests(),
        organizations: [
          { id: 1, title: "Acme" },
          { id: 2, title: "Beta" },
        ],
        isLoading: false,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("select#status-filter").setValue("PENDING");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(1);
    expect(wrapper.text()).toContain("Old Pending");

    await wrapper.find("select#priority-filter").setValue("URGENT");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(0);

    await wrapper.find("select#status-filter").setValue("");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(1);
    expect(wrapper.text()).toContain("New In Review");

    await wrapper.find("select#organization-filter").setValue("1");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(0);

    await wrapper.find("select#priority-filter").setValue("");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(2);

    await wrapper.find("input#search").setValue("corp-req-3");
    await flushPromises();

    const titles = wrapper
      .findAll("[data-test='request-title']")
      .map((n) => (n.text() || "").trim());

    expect(titles).toEqual(["Mid Responded"]);
  });

  test("shows loading state when isLoading is true", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: [],
        organizations: [],
        isLoading: true,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Cargando solicitudes");
    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(0);
  });

  test("emits refresh, view-detail and status-updated events", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: buildRequests(),
        organizations: [{ id: 1, title: "Acme" }],
        isLoading: false,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    const refreshButton = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Actualizar"));

    expect(refreshButton).toBeTruthy();

    await refreshButton.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("refresh")).toBeTruthy();

    await wrapper.find("[data-test='view-detail']").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("view-detail")).toBeTruthy();
    expect(wrapper.emitted("view-detail")[0]).toEqual([2]);

    await wrapper.find("[data-test='status-updated']").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("status-updated")).toBeTruthy();
    expect(wrapper.emitted("status-updated")[0][0]).toMatchObject({
      requestId: 2,
      newStatus: "RESOLVED",
    });
  });

  test("clear filters button appears when no results and clears filters", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: buildRequests(),
        organizations: [{ id: 1, title: "Acme" }],
        isLoading: false,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("input#search").setValue("no-match");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(0);

    const clearButton = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Limpiar Filtros"));

    expect(clearButton).toBeTruthy();

    await clearButton.trigger("click");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']").length).toBeGreaterThan(0);
    expect(wrapper.find("input#search").element.value).toBe("");
  });

  test("pagination shows range, visible pages, and resets when filtered list shrinks", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: buildManyRequests(30),
        organizations: [{ id: 1, title: "Acme" }],
        isLoading: false,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Mostrando 1 a 10 de 30 resultados");

    const pageButtons = wrapper
      .findAll("button")
      .filter((b) => /^[0-9]+$/.test((b.text() || "").trim()));
    expect(pageButtons.map((b) => b.text().trim())).toEqual(["1", "2", "3"]);

    const page3Button = pageButtons.find((b) => b.text().trim() === "3");
    await page3Button.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Mostrando 21 a 30 de 30 resultados");

    await wrapper.find("input#search").setValue("client a");
    await flushPromises();

    expect(wrapper.text()).toContain("Mostrando 1 a 10 de 12 resultados");
    const pageButtonsAfter = wrapper
      .findAll("button")
      .filter((b) => /^[0-9]+$/.test((b.text() || "").trim()));
    expect(pageButtonsAfter.map((b) => b.text().trim())).toEqual(["1", "2"]);
  });

  test("shows empty state messaging when there are no requests", async () => {
    const wrapper = mount(ReceivedRequestsSection, {
      props: {
        requests: [],
        organizations: [],
        isLoading: false,
      },
      global: {
        stubs: {
          CorporateRequestCard: CorporateRequestCardStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("No has recibido solicitudes");
    expect(wrapper.text()).toContain("¿Por qué no hay solicitudes?");
    expect(wrapper.text()).toContain("Asegúrate de tener organizaciones creadas");
    expect(wrapper.text()).not.toContain("Limpiar Filtros");
  });
});
