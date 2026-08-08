import { mount } from "@vue/test-utils";

import AlertForm from "@/components/secop/AlertForm.vue";

describe("AlertForm.vue", () => {
  test("renders Nueva Alerta title when no alert prop", () => {
    const wrapper = mount(AlertForm, {
      props: { alert: null },
    });

    expect(wrapper.text()).toContain("Nueva Alerta");
  });

  test("renders Editar Alerta title when editing", () => {
    const wrapper = mount(AlertForm, {
      props: {
        alert: { id: 1, name: "Existing", keywords: "", frequency: "DAILY" },
      },
    });

    expect(wrapper.text()).toContain("Editar Alerta");
  });

  test("emits save with form data on submit", async () => {
    const wrapper = mount(AlertForm, {
      props: { alert: null },
    });

    const nameInput = wrapper.find("input[type='text']");
    await nameInput.setValue("Test Alert");

    const createButton = wrapper.find("[data-testid='alert-save']");
    await createButton.trigger("click");

    expect(wrapper.emitted("save")).toHaveLength(1);
    expect(wrapper.emitted("save")[0][0]).toEqual({
      name: "Test Alert",
      keywords: "",
      departments: "",
      entities: "",
      procurement_methods: "",
      unspsc_code: "",
      min_budget: null,
      max_budget: null,
      frequency: "DAILY",
    });
  });

  test("disables save button when name is empty", () => {
    const wrapper = mount(AlertForm, {
      props: { alert: null },
    });

    const createButton = wrapper.find("[data-testid='alert-save']");
    expect(createButton.element.disabled).toBe(true);
  });
});
