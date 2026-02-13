import { mount } from "@vue/test-utils";

import RequestCard from "@/components/organizations/client/cards/RequestCard.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = { name: "IconStub", template: "<span />" };
  return {
    __esModule: true,
    EyeIcon: IconStub,
    TagIcon: IconStub,
    CalendarIcon: IconStub,
    ChatBubbleLeftIcon: IconStub,
    ClockIcon: IconStub,
  };
});

jest.mock("@/assets/images/user_avatar.jpg", () => "avatar.jpg");

const buildRequest = (overrides = {}) => ({
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
  corporate_client_name: "Corp",
  organization_info: { id: 1, title: "Acme", profile_image_url: "" },
  ...overrides,
});

describe("RequestCard.vue", () => {
  test("clicking card or button emits view-detail with request id", async () => {
    const wrapper = mount(RequestCard, {
      props: {
        request: buildRequest({ id: 99 }),
      },
    });

    await wrapper.trigger("click");
    expect(wrapper.emitted("view-detail")).toBeTruthy();
    expect(wrapper.emitted("view-detail")[0]).toEqual([99]);

    const detailBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Ver Detalle"));

    expect(detailBtn).toBeTruthy();

    await detailBtn.trigger("click");

    expect(wrapper.emitted("view-detail")).toHaveLength(2);
    expect(wrapper.emitted("view-detail")[1]).toEqual([99]);
  });

  test("renders status/priority labels, classes, progress and organization image", () => {
    const wrapper = mount(RequestCard, {
      props: {
        request: buildRequest({
          status: "PENDING",
          priority: "URGENT",
          organization_info: { id: 1, title: "Acme", profile_image_url: "https://img" },
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

    const img = wrapper.find("img");
    expect(img.attributes("src")).toBe("https://img");
  });

  test("falls back for unknown status/priority and uses avatar", () => {
    const wrapper = mount(RequestCard, {
      props: {
        request: buildRequest({
          status: "ON_HOLD",
          priority: "UNKNOWN",
          organization_info: { id: 1, title: "Acme" },
        }),
      },
    });

    const statusSpan = wrapper.findAll("span").find((s) => s.text() === "ON_HOLD");
    const prioritySpan = wrapper.findAll("span").find((s) => s.text() === "UNKNOWN");

    expect(statusSpan.classes()).toEqual(expect.arrayContaining(["bg-gray-100", "text-gray-800"]));
    expect(prioritySpan.classes()).toEqual(expect.arrayContaining(["bg-gray-100", "text-gray-600"]));

    const progress = wrapper.find(".w-full.bg-gray-200").find("div");
    expect(progress.attributes("style")).toContain("width: 0%");
    expect(progress.classes()).toContain("bg-gray-500");

    const img = wrapper.find("img");
    expect(img.attributes("src")).toBe("avatar.jpg");
  });

  test("formatRelativeDate covers hoy/ayer/dias/semanas y fecha larga", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const wrapper = mount(RequestCard, {
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
    const wrapper = mount(RequestCard, {
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
});
