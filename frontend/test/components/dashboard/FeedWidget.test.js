import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useActivityFeedStore } from "@/stores/dashboard/activity_feed";

import FeedWidget from "@/components/dashboard/widgets/FeedWidget.vue";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  ArrowUpIcon: { name: "ArrowUpIcon", template: "<span data-test='icon-update' />" },
  ArrowDownIcon: { name: "ArrowDownIcon", template: "<span data-test='icon-finish' />" },
  PlusIcon: { name: "PlusIcon", template: "<span data-test='icon-create' />" },
  TrashIcon: { name: "TrashIcon", template: "<span data-test='icon-delete' />" },
  PencilIcon: { name: "PencilIcon", template: "<span data-test='icon-edit' />" },
  QuestionMarkCircleIcon: { name: "QuestionMarkCircleIcon", template: "<span data-test='icon-other' />" },
}));

const flushPromises = async () => {
  await Promise.resolve();
};

describe("FeedWidget.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("calls fetchUserActivities on mount", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const activityFeedStore = useActivityFeedStore();
    const fetchSpy = jest.spyOn(activityFeedStore, "fetchUserActivities").mockResolvedValue();

    mount(FeedWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
        stubs: {
          ArrowUpIcon: { template: "<span />" },
          ArrowDownIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          QuestionMarkCircleIcon: { template: "<span />" },
        },
      },
    });

    await flushPromises();

    expect(fetchSpy).toHaveBeenCalled();
  });

  test("renders loading, error, empty, and list states", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const activityFeedStore = useActivityFeedStore();
    jest.spyOn(activityFeedStore, "fetchUserActivities").mockResolvedValue();

    const wrapper = mount(FeedWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
        stubs: {
          ArrowUpIcon: { template: "<span />" },
          ArrowDownIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          QuestionMarkCircleIcon: { template: "<span />" },
        },
      },
    });

    // Loading
    activityFeedStore.$patch({ loading: true, error: null, activities: [] });
    await flushPromises();
    expect(wrapper.text()).toContain("Cargando actividades...");

    // Error
    activityFeedStore.$patch({ loading: false, error: "boom", activities: [] });
    await flushPromises();
    expect(wrapper.text()).toContain("Error al cargar las actividades");

    // Empty
    activityFeedStore.$patch({ loading: false, error: null, activities: [] });
    await flushPromises();
    expect(wrapper.text()).toContain("No hay actividades registradas");

    // List
    activityFeedStore.$patch({
      loading: false,
      error: null,
      activities: [{ id: 1, type: "create", description: "Did something", time: "Hace 1 minuto" }],
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Did something");
    expect(wrapper.text()).toContain("Hace 1 minuto");
  });

  test("renders correct icon and classes for each activity type and connector line behavior", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const activityFeedStore = useActivityFeedStore();
    jest.spyOn(activityFeedStore, "fetchUserActivities").mockResolvedValue();

    const wrapper = mount(FeedWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
        stubs: {
          ArrowUpIcon: { template: "<span data-test='icon-update' />" },
          ArrowDownIcon: { template: "<span data-test='icon-finish' />" },
          PlusIcon: { template: "<span data-test='icon-create' />" },
          TrashIcon: { template: "<span data-test='icon-delete' />" },
          PencilIcon: { template: "<span data-test='icon-edit' />" },
          QuestionMarkCircleIcon: { template: "<span data-test='icon-other' />" },
        },
      },
    });

    activityFeedStore.$patch({
      loading: false,
      error: null,
      activities: [
        { id: 1, type: "create", description: "Created", time: "t" },
        { id: 2, type: "edit", description: "Edited", time: "t" },
        { id: 3, type: "finish", description: "Finished", time: "t" },
        { id: 4, type: "delete", description: "Deleted", time: "t" },
        { id: 5, type: "update", description: "Updated", time: "t" },
        { id: 6, type: "unknown", description: "Other", time: "t" },
      ],
    });

    await wrapper.vm.$nextTick();

    const items = wrapper.findAll(".timeline-item");
    expect(items).toHaveLength(6);

    expect(wrapper.find("[data-test='icon-create']").exists()).toBe(true);
    expect(wrapper.find("[data-test='icon-edit']").exists()).toBe(true);
    expect(wrapper.find("[data-test='icon-finish']").exists()).toBe(true);
    expect(wrapper.find("[data-test='icon-delete']").exists()).toBe(true);
    expect(wrapper.find("[data-test='icon-update']").exists()).toBe(true);
    expect(wrapper.find("[data-test='icon-other']").exists()).toBe(true);

    const iconContainers = wrapper
      .findAll(".timeline-icon")
      .map((c) => c.find(".w-10.h-10"));
    expect(iconContainers).toHaveLength(6);

    expect(iconContainers[0].classes()).toContain("bg-blue-100");
    expect(iconContainers[0].classes()).toContain("border-blue-600");

    expect(iconContainers[1].classes()).toContain("bg-blue-50");
    expect(iconContainers[1].classes()).toContain("border-blue-500");

    expect(iconContainers[2].classes()).toContain("bg-blue-100");
    expect(iconContainers[2].classes()).toContain("border-blue-700");

    expect(iconContainers[3].classes()).toContain("bg-blue-50");
    expect(iconContainers[3].classes()).toContain("border-blue-400");

    expect(iconContainers[4].classes()).toContain("bg-blue-100");
    expect(iconContainers[4].classes()).toContain("border-blue-600");

    expect(iconContainers[5].classes()).toContain("bg-blue-50");
    expect(iconContainers[5].classes()).toContain("border-blue-500");

    const connectors = wrapper.findAll(".timeline-connector");
    expect(connectors).toHaveLength(5);

    expect(items[0].classes()).not.toContain("last-item");
    expect(items[items.length - 1].classes()).toContain("last-item");

    const { getBorderColorClass, getActivityIconClass, getActivityLineClass } = wrapper.vm;
    expect(getBorderColorClass("create")).toBe("border-blue-600");
    expect(getBorderColorClass("edit")).toBe("border-blue-500");
    expect(getBorderColorClass("finish")).toBe("border-blue-700");
    expect(getBorderColorClass("delete")).toBe("border-blue-400");
    expect(getBorderColorClass("update")).toBe("border-blue-600");
    expect(getBorderColorClass("other")).toBe("border-blue-500");
    expect(getBorderColorClass("unknown")).toBe("border-blue-500");

    expect(getActivityIconClass("create")).toBe("bg-blue-100");
    expect(getActivityIconClass("edit")).toBe("bg-blue-50");
    expect(getActivityIconClass("finish")).toBe("bg-blue-100");
    expect(getActivityIconClass("delete")).toBe("bg-blue-50");
    expect(getActivityIconClass("update")).toBe("bg-blue-100");
    expect(getActivityIconClass("other")).toBe("bg-blue-50");
    expect(getActivityIconClass("unknown")).toBe("bg-blue-50");

    expect(getActivityLineClass("create")).toBe("bg-blue-300");
    expect(getActivityLineClass("edit")).toBe("bg-blue-300");
    expect(getActivityLineClass("finish")).toBe("bg-blue-300");
    expect(getActivityLineClass("delete")).toBe("bg-blue-300");
    expect(getActivityLineClass("update")).toBe("bg-blue-300");
    expect(getActivityLineClass("other")).toBe("bg-blue-300");
    expect(getActivityLineClass("unknown")).toBe("bg-blue-300");
  });
});
