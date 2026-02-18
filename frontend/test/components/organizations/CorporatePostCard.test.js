import { mount } from "@vue/test-utils";

import CorporatePostCard from "@/components/organizations/corporate_client/cards/CorporatePostCard.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    EllipsisVerticalIcon: IconStub,
    PencilIcon: IconStub,
    TrashIcon: IconStub,
    BookmarkIcon: IconStub,
    EyeIcon: IconStub,
    EyeSlashIcon: IconStub,
    LinkIcon: IconStub,
    ArrowTopRightOnSquareIcon: IconStub,
    CalendarIcon: IconStub,
  };
});

const flushPromises = async () => {
  await Promise.resolve();

  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
};

const findButtonByText = (wrapper, matcher) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => {
      const text = (b.text() || "").trim();
      return typeof matcher === "string" ? text === matcher : matcher(text);
    });
  if (!btn) {
    throw new Error("Button not found");
  }
  return btn;
};

const mountPostCard = async (overrides = {}) => {
  const wrapper = mount(CorporatePostCard, {
    props: {
      post: buildPost({ id: 10, title: "P", ...overrides }),
      organizationId: 1,
    },
  });

  await flushPromises();

  return wrapper;
};

const openMenu = async (wrapper) => {
  const toggleBtn = wrapper.findAll("button")[0];
  if (!toggleBtn) {
    throw new Error("Toggle button not found");
  }
  await toggleBtn.trigger("click");
  await flushPromises();
};

const buildPost = (overrides = {}) => ({
  id: 1,
  title: "Post",
  content: "Content",
  is_pinned: false,
  is_active: true,
  has_link: false,
  link_name: "",
  link_url: "",
  created_at: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

describe("CorporatePostCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("opens actions menu and emits edit; menu closes", async () => {
    const wrapper = await mountPostCard();

    await openMenu(wrapper);

    const editBtn = findButtonByText(wrapper, "Editar");
    await editBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("edit")?.[0]).toEqual([expect.objectContaining({ id: 10 })]);
    expect(wrapper.find("div.fixed.inset-0.z-0").exists()).toBe(false);
  });

  test("emits toggle-pin when selecting pin action", async () => {
    const wrapper = await mountPostCard();

    await openMenu(wrapper);

    const pinBtn = findButtonByText(wrapper, (text) => text.includes("Fijar"));
    await pinBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("toggle-pin")?.[0]).toEqual([expect.objectContaining({ id: 10 })]);
  });

  test("emits toggle-status when selecting status action", async () => {
    const wrapper = await mountPostCard();

    await openMenu(wrapper);

    const statusBtn = findButtonByText(
      wrapper,
      (text) => text.includes("Desactivar") || text.includes("Activar")
    );
    await statusBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("toggle-status")?.[0]).toEqual([expect.objectContaining({ id: 10 })]);
  });

  test("emits delete when selecting delete action", async () => {
    const wrapper = await mountPostCard();

    await openMenu(wrapper);

    const deleteBtn = findButtonByText(wrapper, "Eliminar");
    await deleteBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("delete")?.[0]).toEqual([expect.objectContaining({ id: 10 })]);
  });

  test("clicking backdrop closes actions menu without emitting", async () => {
    const wrapper = mount(CorporatePostCard, {
      props: {
        post: buildPost({ id: 1 }),
        organizationId: 1,
      },
    });

    await flushPromises();

    const toggleBtn = wrapper.findAll("button")[0];
    await toggleBtn.trigger("click");
    await flushPromises();

    const backdrop = wrapper.find("div.fixed.inset-0.z-0");
    expect(backdrop.exists()).toBe(true);

    await backdrop.trigger("click");
    await flushPromises();

    expect(wrapper.find("div.fixed.inset-0.z-0").exists()).toBe(false);

    expect(wrapper.emitted("edit")).toBeFalsy();
    expect(wrapper.emitted("delete")).toBeFalsy();
    expect(wrapper.emitted("toggle-pin")).toBeFalsy();
    expect(wrapper.emitted("toggle-status")).toBeFalsy();
  });

  test("formats relative date for today, yesterday, days, weeks, and older posts", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));

    const mountForDate = async (createdAt) => {
      const wrapper = mount(CorporatePostCard, {
        props: {
          post: buildPost({ created_at: createdAt }),
          organizationId: 1,
        },
      });

      await wrapper.vm.$nextTick();
      return wrapper;
    };

    const todayWrapper = await mountForDate("2026-02-15T12:00:00.000Z");
    expect(todayWrapper.text()).toContain("Creado hoy");

    const yesterdayWrapper = await mountForDate("2026-02-14T12:00:00.000Z");
    expect(yesterdayWrapper.text()).toContain("Creado ayer");

    const daysWrapper = await mountForDate("2026-02-12T12:00:00.000Z");
    expect(daysWrapper.text()).toContain("Creado hace 3 días");

    const weeksWrapper = await mountForDate("2026-02-07T12:00:00.000Z");
    expect(weeksWrapper.text()).toContain("Creado hace 2 semanas");

    const olderDate = "2025-12-01T12:00:00.000Z";
    const olderWrapper = await mountForDate(olderDate);
    const expectedDate = new Date(olderDate).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(olderWrapper.text()).toContain(`Creado el ${expectedDate}`);
  });

  test("formatRelativeDate returns expected labels for all ranges", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));

    const wrapper = mount(CorporatePostCard, {
      props: {
        post: buildPost({ created_at: "2026-02-15T12:00:00.000Z" }),
        organizationId: 1,
      },
    });

    const { formatRelativeDate } = wrapper.vm.$.setupState;

    expect(formatRelativeDate("2026-02-15T12:00:00.000Z")).toBe("hoy");
    expect(formatRelativeDate("2026-02-14T12:00:00.000Z")).toBe("ayer");
    expect(formatRelativeDate("2026-02-12T12:00:00.000Z")).toBe("hace 3 días");
    expect(formatRelativeDate("2026-02-07T12:00:00.000Z")).toBe("hace 2 semanas");

    const olderDate = "2025-12-01T12:00:00.000Z";
    const expectedDate = new Date(olderDate).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(formatRelativeDate(olderDate)).toBe(`el ${expectedDate}`);

    jest.useRealTimers();
  });
});
