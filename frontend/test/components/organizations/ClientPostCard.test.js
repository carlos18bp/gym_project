import { mount } from "@vue/test-utils";

import ClientPostCard from "@/components/organizations/client/cards/ClientPostCard.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = { name: "IconStub", template: "<span />" };
  return {
    __esModule: true,
    BookmarkIcon: IconStub,
    LinkIcon: IconStub,
    ArrowTopRightOnSquareIcon: IconStub,
    CalendarIcon: IconStub,
    UserIcon: IconStub,
  };
});

const buildPost = (overrides = {}) => ({
  id: 1,
  title: "Post",
  content: "Content",
  author_name: "Corp",
  is_pinned: false,
  has_link: false,
  link_name: "",
  link_url: "",
  created_at: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

describe("ClientPostCard.vue", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  test("shows 'Reciente' for posts within last 3 days", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-10T00:00:00.000Z"));

    const wrapper = mount(ClientPostCard, {
      props: {
        post: buildPost({ created_at: "2026-02-09T00:00:00.000Z" }),
      },
    });

    expect(wrapper.text()).toContain("Reciente");

    await wrapper.setProps({ post: buildPost({ created_at: "2026-02-01T00:00:00.000Z" }) });

    expect(wrapper.text()).not.toContain("Reciente");

    jest.useRealTimers();
  });

  test("renders pinned labels and link fallback", async () => {
    const wrapper = mount(ClientPostCard, {
      props: {
        post: buildPost({
          is_pinned: true,
          has_link: true,
          link_url: "https://example.com",
          link_name: "",
        }),
      },
    });

    expect(wrapper.text()).toContain("Fijado");
    expect(wrapper.text()).toContain("Anuncio Destacado");
    expect(wrapper.text()).toContain("Ver enlace");
    expect(wrapper.find("a").attributes("href")).toBe("https://example.com");

    await wrapper.setProps({ post: buildPost({ has_link: false }) });
    expect(wrapper.find("a").exists()).toBe(false);
  });

  test("formatRelativeDate covers minutes/hours/days/weeks/months and long dates", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const wrapper = mount(ClientPostCard, {
      props: {
        post: buildPost({ created_at: new Date(now.getTime() - 30 * 1000).toISOString() }),
      },
    });

    expect(wrapper.text()).toContain("hace un momento");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("hace 5 minutos");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("hace 1 hora");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("hace 3 horas");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("ayer");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("hace 5 días");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("hace 2 semanas");

    await wrapper.setProps({
      post: buildPost({ created_at: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString() }),
    });
    expect(wrapper.text()).toContain("hace 2 meses");

    const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
    await wrapper.setProps({ post: buildPost({ created_at: oldDate.toISOString() }) });
    const expected = oldDate.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(wrapper.text()).toContain(expected);

    jest.useRealTimers();
  });
});
