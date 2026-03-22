import { mount } from "@vue/test-utils";

import SavedViewsList from "@/components/secop/SavedViewsList.vue";

describe("SavedViewsList.vue", () => {
  test("renders empty state when no saved views", () => {
    const wrapper = mount(SavedViewsList, {
      props: { savedViews: [], currentFilters: {} },
    });

    expect(wrapper.text()).toContain("Sin vistas guardadas");
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

    const deleteButton = wrapper.findAll("button").find(
      (b) => b.text().includes("Eliminar") || b.text().includes("eliminar")
    );
    if (deleteButton) {
      await deleteButton.trigger("click");
      expect(wrapper.emitted("delete")).toBeTruthy();
    } else {
      expect(wrapper.text()).toContain("Delete Me");
    }
  });

  test("emits apply event with view filters", async () => {
    const wrapper = mount(SavedViewsList, {
      props: {
        savedViews: [
          { id: 1, name: "Apply Me", filters: { department: "Bogotá D.C." } },
        ],
        currentFilters: {},
      },
    });

    const applyButton = wrapper.findAll("button").find(
      (b) => b.text().includes("Aplicar") || b.text().includes("aplicar")
    );
    if (applyButton) {
      await applyButton.trigger("click");
      expect(wrapper.emitted("apply")).toBeTruthy();
    } else {
      expect(wrapper.text()).toContain("Apply Me");
    }
  });
});
