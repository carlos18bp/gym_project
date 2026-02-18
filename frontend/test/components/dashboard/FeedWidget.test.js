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

const activityFixtures = [
  { id: 1, type: "create", description: "Created", time: "t" },
  { id: 2, type: "edit", description: "Edited", time: "t" },
  { id: 3, type: "finish", description: "Finished", time: "t" },
  { id: 4, type: "delete", description: "Deleted", time: "t" },
  { id: 5, type: "update", description: "Updated", time: "t" },
  { id: 6, type: "unknown", description: "Other", time: "t" },
];

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

  const mountWithActivities = async () => {
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
      activities: activityFixtures,
    });

    await wrapper.vm.$nextTick();

    return wrapper;
  };

  test("renders timeline items, connectors, and icons for activity types", async () => {
    const wrapper = await mountWithActivities();

    const items = wrapper.findAll(".timeline-item");
    const connectors = wrapper.findAll(".timeline-connector");

    expect([items.length, connectors.length]).toEqual([6, 5]);

    const iconExists = [
      "icon-create",
      "icon-edit",
      "icon-finish",
      "icon-delete",
      "icon-update",
      "icon-other",
    ].map((selector) => wrapper.find(`[data-test='${selector}']`).exists());
    expect(iconExists).toEqual([true, true, true, true, true, true]);

    expect([
      items[0].classes().includes("last-item"),
      items[items.length - 1].classes().includes("last-item"),
    ]).toEqual([false, true]);
  });

  test("applies expected icon container classes", async () => {
    const wrapper = await mountWithActivities();

    const iconContainers = wrapper
      .findAll(".timeline-icon")
      .map((c) => c.find(".w-10.h-10"));
    const expectedPairs = [
      ["bg-blue-100", "border-blue-600"],
      ["bg-blue-50", "border-blue-500"],
      ["bg-blue-100", "border-blue-700"],
      ["bg-blue-50", "border-blue-400"],
      ["bg-blue-100", "border-blue-600"],
      ["bg-blue-50", "border-blue-500"],
    ];

    const matches = iconContainers.map((container, idx) =>
      expectedPairs[idx].every((cls) => container.classes().includes(cls))
    );
    expect(matches).toEqual(new Array(expectedPairs.length).fill(true));
  });

  test("maps activity types to icon, border, and line classes", async () => {
    const wrapper = await mountWithActivities();
    const { getBorderColorClass, getActivityIconClass, getActivityLineClass } = wrapper.vm;
    const types = ["create", "edit", "finish", "delete", "update", "other", "unknown"];

    expect(types.map((type) => getBorderColorClass(type))).toEqual([
      "border-blue-600",
      "border-blue-500",
      "border-blue-700",
      "border-blue-400",
      "border-blue-600",
      "border-blue-500",
      "border-blue-500",
    ]);
    expect(types.map((type) => getActivityIconClass(type))).toEqual([
      "bg-blue-100",
      "bg-blue-50",
      "bg-blue-100",
      "bg-blue-50",
      "bg-blue-100",
      "bg-blue-50",
      "bg-blue-50",
    ]);
    expect(types.map((type) => getActivityLineClass(type))).toEqual([
      "bg-blue-300",
      "bg-blue-300",
      "bg-blue-300",
      "bg-blue-300",
      "bg-blue-300",
      "bg-blue-300",
      "bg-blue-300",
    ]);
  });
});
