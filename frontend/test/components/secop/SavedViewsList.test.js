import { mount } from "@vue/test-utils";

import SavedViewsList from "@/components/secop/SavedViewsList.vue";

describe("SavedViewsList.vue", () => {
  test("renders empty state when no saved views", () => {
    const wrapper = mount(SavedViewsList, {
      props: { savedViews: [], currentFilters: {} },
    });

    expect(wrapper.text()).toContain("Sin filtros guardados");
  });

  test("renders saved view cards with name", () => {
    const wrapper = mount(SavedViewsList, {
      props: {
        savedViews: [
          { id: 1, name: "View One", filters: { department: "Antioquia" } },
          { id: 2, name: "View Two", filters: { status: "Abierto" } },
        ],
        currentFilters: {},
      },
    });

    expect(wrapper.text()).toContain("View One");
    expect(wrapper.text()).toContain("View Two");
  });

  test("emits delete event with view id", async () => {
    const wrapper = mount(SavedViewsList, {
      props: {
        savedViews: [
          { id: 1, name: "Delete Me", filters: {} },
        ],
        currentFilters: {},
      },
    });

    await wrapper.find("[data-testid='saved-view-delete-1']").trigger("click");

    expect(wrapper.emitted("delete")).toHaveLength(1);
    expect(wrapper.emitted("delete")[0]).toEqual([1]);
  });

  test("emits apply event with view filters", async () => {
    const view = { id: 1, name: "Apply Me", filters: { department: "Bogotá D.C." } };
    const wrapper = mount(SavedViewsList, {
      props: {
        savedViews: [view],
        currentFilters: {},
      },
    });

    await wrapper.find("[data-testid='saved-view-apply-1']").trigger("click");

    expect(wrapper.emitted("apply")).toHaveLength(1);
    expect(wrapper.emitted("apply")[0]).toEqual([view]);
  });
});
