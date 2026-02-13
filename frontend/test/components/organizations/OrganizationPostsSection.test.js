import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationPostsStore } from "@/stores/organization_posts";

import OrganizationPostsSection from "@/components/organizations/client/sections/OrganizationPostsSection.vue";

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    SpeakerWaveIcon: IconStub,
    ArrowPathIcon: IconStub,
    InformationCircleIcon: IconStub,
    LockClosedIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const ClientPostCardStub = {
  name: "ClientPostCard",
  props: ["post"],
  template: "<div data-test='post-card'>{{ post.title }}</div>",
};

describe("OrganizationPostsSection.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("loads posts on mount and renders pinned posts first", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();

    store.$patch({
      publicPosts: [
        { id: 1, title: "Regular", is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 2, title: "Pinned", is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
      ],
      isLoadingPosts: false,
    });

    const getPublicPostsSpy = jest
      .spyOn(store, "getPublicPosts")
      .mockResolvedValue({ results: store.publicPosts });

    const wrapper = mount(OrganizationPostsSection, {
      props: { organizationId: 99 },
      global: {
        plugins: [pinia],
        stubs: {
          ClientPostCard: ClientPostCardStub,
        },
      },
    });

    await flushPromises();

    expect(getPublicPostsSpy).toHaveBeenCalledWith(99);

    const renderedTitles = wrapper
      .findAll("[data-test='post-card']")
      .map((n) => (n.text() || "").trim());

    expect(renderedTitles).toEqual(["Pinned", "Regular"]);
  });

  test("when API returns 403, shows access empty state and does not notify", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();

    jest.spyOn(store, "getPublicPosts").mockRejectedValue({
      response: { status: 403 },
    });

    const wrapper = mount(OrganizationPostsSection, {
      props: { organizationId: 1 },
      global: {
        plugins: [pinia],
        stubs: {
          ClientPostCard: ClientPostCardStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("No tienes acceso a estos anuncios");
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("when API returns non-403 error, shows notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();

    jest.spyOn(store, "getPublicPosts").mockRejectedValue({
      response: { status: 500 },
    });

    mount(OrganizationPostsSection, {
      props: { organizationId: 1 },
      global: {
        plugins: [pinia],
        stubs: {
          ClientPostCard: ClientPostCardStub,
        },
      },
    });

    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Error al cargar los anuncios", "error");
  });

  test("clicking refresh calls getPublicPosts again", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();

    const getPublicPostsSpy = jest.spyOn(store, "getPublicPosts").mockResolvedValue({ results: [] });

    const wrapper = mount(OrganizationPostsSection, {
      props: { organizationId: 5 },
      global: {
        plugins: [pinia],
        stubs: {
          ClientPostCard: ClientPostCardStub,
        },
      },
    });

    await flushPromises();

    expect(getPublicPostsSpy).toHaveBeenCalledTimes(1);

    const refreshButton = wrapper
      .findAll("button")
      .find((btn) => (btn.text() || "").includes("Actualizar"));

    expect(refreshButton).toBeTruthy();

    await refreshButton.trigger("click");
    await flushPromises();

    expect(getPublicPostsSpy).toHaveBeenCalledTimes(2);
  });
});
