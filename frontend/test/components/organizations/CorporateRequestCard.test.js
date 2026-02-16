import { mount } from "@vue/test-utils";

import CorporateRequestCard from "@/components/organizations/corporate_client/cards/CorporateRequestCard.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    EyeIcon: IconStub,
    TagIcon: IconStub,
    CalendarIcon: IconStub,
    ChatBubbleLeftIcon: IconStub,
    ClockIcon: IconStub,
    ArrowPathIcon: IconStub,
  };
});

jest.mock("@/assets/images/user_avatar.jpg", () => "avatar.jpg");

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildRequest = (overrides = {}) => {
  return {
    id: 1,
    request_number: "CORP-REQ-1",
    title: "Req",
    description: "Desc",
    status: "PENDING",
    priority: "MEDIUM",
    request_type_name: "Consulta",
    created_at: "2026-02-01T00:00:00.000Z",
    status_updated_at: "2026-02-01T00:00:00.000Z",
    response_count: 0,
    days_since_created: 1,
    client_info: {
      full_name: "Client",
      email: "client@example.com",
      profile_image_url: "",
    },
    organization_info: {
      id: 10,
      title: "Acme",
      profile_image_url: "",
    },
    ...overrides,
  };
};

describe("CorporateRequestCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("clicking 'Ver Detalle' emits view-detail", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({ id: 123 }),
      },
    });

    await flushPromises();

    const viewBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Ver Detalle") || (b.text() || "").trim() === "Detalle");

    expect(viewBtn).toBeTruthy();

    await viewBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("view-detail")).toBeTruthy();
    expect(wrapper.emitted("view-detail")[0]).toEqual([123]);
  });

  test("renders status/priority classes, progress bar, and status description", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({
          status: "PENDING",
          priority: "URGENT",
          client_info: {
            full_name: "Client",
            email: "client@example.com",
            profile_image_url: "https://client-img",
          },
          organization_info: {
            id: 10,
            title: "Acme",
            profile_image_url: "https://org-img",
          },
        }),
      },
    });

    const statusSpan = wrapper.findAll("span").find((s) => s.text() === "Pendiente");
    const prioritySpan = wrapper.findAll("span").find((s) => s.text() === "Urgente");

    expect(statusSpan.classes()).toEqual(expect.arrayContaining(["bg-yellow-100", "text-yellow-800"]));
    expect(prioritySpan.classes()).toEqual(expect.arrayContaining(["bg-red-100", "text-red-600"]));

    const progress = wrapper.find(".w-full.bg-gray-200").find("div");
    expect(progress.attributes("style")).toContain("width: 20%");
    expect(progress.classes()).toContain("bg-yellow-500");

    expect(wrapper.text()).toContain("La solicitud está esperando revisión inicial");

    const images = wrapper.findAll("img");
    expect(images[0].attributes("src")).toBe("https://client-img");
    expect(images[1].attributes("src")).toBe("https://org-img");
  });

  test("falls back for unknown status/priority and uses avatar images", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({
          status: "UNKNOWN",
          priority: "OTHER",
          client_info: { full_name: "Client", email: "client@example.com" },
          organization_info: { id: 10, title: "Acme" },
        }),
      },
    });

    const statusSpan = wrapper.findAll("span").find((s) => s.text() === "UNKNOWN");
    const prioritySpan = wrapper.findAll("span").find((s) => s.text() === "OTHER");

    expect(statusSpan.classes()).toEqual(expect.arrayContaining(["bg-gray-100", "text-gray-800"]));
    expect(prioritySpan.classes()).toEqual(expect.arrayContaining(["bg-gray-100", "text-gray-600"]));

    const progress = wrapper.find(".w-full.bg-gray-200").find("div");
    expect(progress.attributes("style")).toContain("width: 0%");
    expect(progress.classes()).toContain("bg-gray-500");

    expect(wrapper.text()).toContain("Estado desconocido");

    const images = wrapper.findAll("img");
    expect(images[0].attributes("src")).toBe("avatar.jpg");
    expect(images[1].attributes("src")).toBe("avatar.jpg");
  });

  test("formatRelativeDate handles hoy/ayer/dias/semanas and long date", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({
          created_at: now.toISOString(),
          status_updated_at: now.toISOString(),
        }),
      },
    });

    expect(wrapper.text()).toContain("Hoy");

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await wrapper.setProps({
      request: buildRequest({ created_at: yesterday.toISOString(), status_updated_at: yesterday.toISOString() }),
    });
    expect(wrapper.text()).toContain("Ayer");

    const threeDays = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    await wrapper.setProps({
      request: buildRequest({ created_at: threeDays.toISOString(), status_updated_at: threeDays.toISOString() }),
    });
    expect(wrapper.text()).toContain("Hace 3 días");

    const tenDays = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    await wrapper.setProps({
      request: buildRequest({ created_at: tenDays.toISOString(), status_updated_at: tenDays.toISOString() }),
    });
    expect(wrapper.text()).toContain("Hace 2 semanas");

    const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    await wrapper.setProps({
      request: buildRequest({ created_at: oldDate.toISOString(), status_updated_at: oldDate.toISOString() }),
    });
    const expected = oldDate.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(wrapper.text()).toContain(expected);

    jest.useRealTimers();
  });

  test("shows last updated block when status_updated_at differs", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({
          created_at: now.toISOString(),
          status_updated_at: yesterday.toISOString(),
        }),
      },
    });

    expect(wrapper.text()).toContain("Última actualización:");
    expect(wrapper.text()).toContain("Ayer");

    jest.useRealTimers();
  });

  test("status menu: opens, selecting a different status emits status-updated and closes", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({ id: 5, status: "PENDING" }),
      },
    });

    await flushPromises();

    const statusMenuToggle = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Cambiar Estado") || (b.text() || "").trim() === "Estado");

    expect(statusMenuToggle).toBeTruthy();

    await statusMenuToggle.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Resuelta");

    const resolvedOption = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Resuelta"));

    expect(resolvedOption).toBeTruthy();

    await resolvedOption.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("status-updated")).toBeTruthy();
    expect(wrapper.emitted("status-updated")[0][0]).toMatchObject({
      requestId: 5,
      newStatus: "RESOLVED",
    });

    // Menu should be closed (overlay removed)
    expect(wrapper.find("div.fixed.inset-0").exists()).toBe(false);
  });

  test("selecting the same status is a no-op (does not emit)", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({ id: 7, status: "PENDING" }),
      },
    });

    await flushPromises();

    const statusMenuToggle = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Cambiar Estado") || (b.text() || "").trim() === "Estado");

    await statusMenuToggle.trigger("click");
    await flushPromises();

    const pendingOption = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Pendiente"));

    expect(pendingOption).toBeTruthy();

    await pendingOption.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("status-updated")).toBeFalsy();

    // Menu should be closed
    expect(wrapper.find("div.fixed.inset-0").exists()).toBe(false);
  });

  test("status menu options are disabled while updating", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({ status: "PENDING" }),
      },
    });

    await flushPromises();

    wrapper.vm.showStatusMenu = true;
    wrapper.vm.isUpdating = true;
    await wrapper.vm.$nextTick();

    const option = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Resuelta"));

    expect(option.attributes("disabled")).toBeDefined();
  });

  test("clicking the backdrop closes the status menu", async () => {
    const wrapper = mount(CorporateRequestCard, {
      props: {
        request: buildRequest({ status: "PENDING" }),
      },
    });

    await flushPromises();

    const statusMenuToggle = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Cambiar Estado") || (b.text() || "").trim() === "Estado");

    await statusMenuToggle.trigger("click");
    await flushPromises();

    const backdrop = wrapper.find("div.fixed.inset-0");
    expect(backdrop.exists()).toBe(true);

    await backdrop.trigger("click");
    await flushPromises();

    expect(wrapper.find("div.fixed.inset-0").exists()).toBe(false);
  });
});
