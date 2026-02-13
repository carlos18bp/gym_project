import { mount } from "@vue/test-utils";

import MyRequestsSection from "@/components/organizations/client/sections/MyRequestsSection.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    ClipboardDocumentListIcon: IconStub,
    PlusIcon: IconStub,
    InformationCircleIcon: IconStub,
    XMarkIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const RequestCardStub = {
  name: "RequestCard",
  props: ["request"],
  template: `
    <div data-test="request-card">
      <span data-test="request-title">{{ request.title }}</span>
      <button type="button" data-test="view-detail" @click="$emit('view-detail', request.id)">Ver Detalle</button>
    </div>
  `,
};

describe("MyRequestsSection.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders requests sorted by created_at (newest first) and filters by status/priority/search", async () => {
    const requests = [
      {
        id: 1,
        title: "Old Request",
        request_number: "CORP-REQ-1",
        description: "Something",
        status: "PENDING",
        priority: "LOW",
        created_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        title: "New Request",
        request_number: "CORP-REQ-2",
        description: "Important",
        status: "RESPONDED",
        priority: "HIGH",
        created_at: "2025-02-01T00:00:00.000Z",
      },
      {
        id: 3,
        title: "Another Pending",
        request_number: "CORP-REQ-3",
        description: "Other",
        status: "PENDING",
        priority: "HIGH",
        created_at: "2025-01-15T00:00:00.000Z",
      },
    ];

    const wrapper = mount(MyRequestsSection, {
      props: {
        requests,
        isLoading: false,
      },
      global: {
        stubs: {
          RequestCard: RequestCardStub,
        },
      },
    });

    await flushPromises();

    const titles = wrapper
      .findAll("[data-test='request-title']")
      .map((n) => (n.text() || "").trim());

    expect(titles).toEqual(["New Request", "Another Pending", "Old Request"]);

    await wrapper.find("select#status-filter").setValue("PENDING");
    await flushPromises();

    const pendingTitles = wrapper
      .findAll("[data-test='request-title']")
      .map((n) => (n.text() || "").trim());

    expect(pendingTitles).toEqual(["Another Pending", "Old Request"]);

    await wrapper.find("select#priority-filter").setValue("HIGH");
    await flushPromises();

    const pendingHighTitles = wrapper
      .findAll("[data-test='request-title']")
      .map((n) => (n.text() || "").trim());

    expect(pendingHighTitles).toEqual(["Another Pending"]);

    await wrapper.find("input#search").setValue("corp-req-3");
    await flushPromises();

    const searchTitles = wrapper
      .findAll("[data-test='request-title']")
      .map((n) => (n.text() || "").trim());

    expect(searchTitles).toEqual(["Another Pending"]);
  });

  test("emits request-detail when a RequestCard emits view-detail", async () => {
    const wrapper = mount(MyRequestsSection, {
      props: {
        requests: [
          {
            id: 55,
            title: "R",
            request_number: "CORP-REQ-55",
            description: "",
            status: "PENDING",
            priority: "LOW",
            created_at: "2025-02-01T00:00:00.000Z",
          },
        ],
        isLoading: false,
      },
      global: {
        stubs: {
          RequestCard: RequestCardStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='view-detail']").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("request-detail")).toBeTruthy();
    expect(wrapper.emitted("request-detail")[0]).toEqual([55]);
  });

  test("shows 'Limpiar Filtros' when filters yield no results and clears filters to restore list", async () => {
    const requests = [
      {
        id: 1,
        title: "Alpha",
        request_number: "CORP-REQ-1",
        description: "",
        status: "PENDING",
        priority: "LOW",
        created_at: "2025-02-01T00:00:00.000Z",
      },
    ];

    const wrapper = mount(MyRequestsSection, {
      props: {
        requests,
        isLoading: false,
      },
      global: {
        stubs: {
          RequestCard: RequestCardStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(1);

    await wrapper.find("input#search").setValue("no-match");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(0);

    const clearButton = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Limpiar Filtros"));

    expect(clearButton).toBeTruthy();

    await clearButton.trigger("click");
    await flushPromises();

    expect(wrapper.findAll("[data-test='request-card']")).toHaveLength(1);
    expect((wrapper.find("input#search").element).value).toBe("");
  });

  test("empty state shows correct text when no requests", async () => {
    const wrapper = mount(MyRequestsSection, {
      props: {
        requests: [],
        isLoading: false,
      },
      global: {
        stubs: {
          RequestCard: RequestCardStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("No has enviado solicitudes");
    expect(wrapper.text()).toContain("Cuando envíes solicitudes corporativas");
  });

  test("clicking header 'Nueva Solicitud' emits create-request", async () => {
    const wrapper = mount(MyRequestsSection, {
      props: {
        requests: [],
        isLoading: false,
      },
      global: {
        stubs: {
          RequestCard: RequestCardStub,
        },
      },
    });

    await flushPromises();

    const header = wrapper.find(".mb-6");
    const createButton = header
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Nueva Solicitud"));

    expect(createButton).toBeTruthy();

    await createButton.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("create-request")).toBeTruthy();
  });
});
