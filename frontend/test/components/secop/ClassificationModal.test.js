import { mount } from "@vue/test-utils";

import ClassificationModal from "@/components/secop/ClassificationModal.vue";

describe("ClassificationModal.vue", () => {
  const baseProps = {
    process: { id: 1, procedure_name: "Test Process", entity_name: "Test Entity" },
  };

  test("renders Clasificar Proceso title when no current classification", () => {
    const wrapper = mount(ClassificationModal, {
      props: { ...baseProps, currentClassification: null },
    });

    expect(wrapper.text()).toContain("Clasificar Proceso");
  });

  test("renders Editar Clasificación title when editing", () => {
    const wrapper = mount(ClassificationModal, {
      props: {
        ...baseProps,
        currentClassification: { id: 1, status: "INTERESTING", notes: "" },
      },
    });

    expect(wrapper.text()).toContain("Editar Clasificación");
  });

  test("emits save event with correct payload", async () => {
    const wrapper = mount(ClassificationModal, {
      props: { ...baseProps, currentClassification: null },
    });

    const saveButton = wrapper.findAll("button").find((b) => b.text() === "Guardar");
    await saveButton.trigger("click");

    expect(wrapper.emitted("save")).toBeTruthy();
    const payload = wrapper.emitted("save")[0][0];
    expect(payload).toHaveProperty("process", 1);
    expect(payload).toHaveProperty("status");
    expect(payload).toHaveProperty("notes");
  });

  test("emits close on cancel click", async () => {
    const wrapper = mount(ClassificationModal, {
      props: { ...baseProps, currentClassification: null },
    });

    const cancelButton = wrapper.findAll("button").find((b) => b.text() === "Cancelar");
    await cancelButton.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("emits delete with classification id when editing", async () => {
    const wrapper = mount(ClassificationModal, {
      props: {
        ...baseProps,
        currentClassification: { id: 5, status: "INTERESTING", notes: "" },
      },
    });

    const deleteButton = wrapper.findAll("button").find((b) => b.text() === "Eliminar");
    await deleteButton.trigger("click");

    expect(wrapper.emitted("delete")).toBeTruthy();
    expect(wrapper.emitted("delete")[0]).toEqual([5, 1]);
  });
});
