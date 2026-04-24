import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

import ServicesAdmin from "@/views/services/ServicesAdmin.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const sampleService = {
  id: 1,
  name: "Registro Marcario",
  short_title: "Registro",
  slug: "registro",
  description: "Descripcion del servicio",
  is_active: true,
  is_featured: false,
  featured_order: 0,
  stages: [
    {
      id: 10,
      title: "Etapa 1",
      description: "Primera etapa",
      order: 1,
      is_active: true,
      fields: [
        {
          id: 100,
          key: "nombre",
          label: "Nombre",
          field_type: "input",
          placeholder: "",
          help_text: "",
          is_required: true,
          order: 1,
          options: null,
          allowed_extensions: null,
          allow_multiple_files: false,
          max_files: 1,
        },
      ],
    },
  ],
};

describe("ServicesAdmin.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
    store.fetchAdminServices = jest.fn().mockResolvedValue([sampleService]);
    store.createService = jest.fn().mockResolvedValue({ id: 99 });
    store.updateService = jest.fn().mockResolvedValue({ id: 1 });
    store.toggleServiceActive = jest.fn().mockResolvedValue({});
    store.toggleServiceFeatured = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders service list on mount", async () => {
    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    expect(wrapper.text()).toContain("Registro Marcario");
  });

  test("editService populates editor with service data", async () => {
    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const serviceBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Registro Marcario")
    );
    await serviceBtn.trigger("click");

    expect(wrapper.find("input[placeholder='Nombre del servicio']").element.value).toBe(
      "Registro Marcario"
    );
  });

  test("startCreate clears the editor", async () => {
    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    // First edit an existing service
    const serviceBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Registro Marcario")
    );
    await serviceBtn.trigger("click");

    // Then click Nuevo
    const newBtn = wrapper.findAll("button").find((b) => b.text() === "Nuevo");
    await newBtn.trigger("click");

    expect(wrapper.find("input[placeholder='Nombre del servicio']").element.value).toBe("");
  });

  test("addStage adds a new stage row", async () => {
    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const addStageBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Agregar etapa")
    );
    const stagesBefore = wrapper.findAll("h3").filter((el) =>
      el.text().includes("Etapa")
    ).length;

    await addStageBtn.trigger("click");

    const stagesAfter = wrapper.findAll("h3").filter((el) =>
      el.text().includes("Etapa")
    ).length;
    expect(stagesAfter).toBe(stagesBefore + 1);
  });

  test("removeStage does not remove the last remaining stage", async () => {
    // Start with a fresh editor that has only 1 stage (default)
    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const removeBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Eliminar etapa")
    );
    await removeBtn.trigger("click");

    // Should still have 1 stage
    const stages = wrapper.findAll("h3").filter((el) => el.text().includes("Etapa"));
    expect(stages.length).toBe(1);
  });

  test("saveService calls createService for a new service", async () => {
    store.fetchAdminServices = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...sampleService, id: 99, name: "Nuevo Servicio" }]);

    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    await wrapper.find("input[placeholder='Nombre del servicio']").setValue("Nuevo Servicio");
    await wrapper.find("input[placeholder='Titulo corto (1-2 palabras)']").setValue("Nuevo");
    await wrapper.find("input[placeholder='Titulo etapa']").setValue("Etapa de Prueba");
    await wrapper.find("input[placeholder='key_campo']").setValue("campo_1");
    await wrapper.find("input[placeholder='Etiqueta']").setValue("Campo Uno");

    const saveBtn = wrapper.findAll("button").find((b) =>
      b.text() === "Guardar servicio"
    );
    await saveBtn.trigger("click");
    await flushPromises();

    expect(store.createService).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith("Servicio creado", "success");
  });

  test("saveService calls updateService when editing an existing service", async () => {
    store.fetchAdminServices = jest
      .fn()
      .mockResolvedValueOnce([sampleService])
      .mockResolvedValueOnce([sampleService]);

    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const serviceBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Registro Marcario")
    );
    await serviceBtn.trigger("click");

    const saveBtn = wrapper.findAll("button").find((b) =>
      b.text() === "Guardar servicio"
    );
    await saveBtn.trigger("click");
    await flushPromises();

    expect(store.updateService).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith("Servicio actualizado", "success");
  });

  test("saveService shows warning when name is missing", async () => {
    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const saveBtn = wrapper.findAll("button").find((b) =>
      b.text() === "Guardar servicio"
    );
    await saveBtn.trigger("click");
    await flushPromises();

    expect(store.createService).not.toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("nombre"),
      "warning"
    );
  });

  test("toggleActive calls toggleServiceActive and reloads services", async () => {
    store.fetchAdminServices = jest
      .fn()
      .mockResolvedValueOnce([sampleService])
      .mockResolvedValueOnce([{ ...sampleService, is_active: false }]);

    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const serviceBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Registro Marcario")
    );
    await serviceBtn.trigger("click");

    const toggleBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Desactivar")
    );
    await toggleBtn.trigger("click");
    await flushPromises();

    expect(store.toggleServiceActive).toHaveBeenCalledWith(1);
    expect(store.fetchAdminServices).toHaveBeenCalledTimes(2);
  });

  test("toggleFeatured calls toggleServiceFeatured and reloads services", async () => {
    store.fetchAdminServices = jest
      .fn()
      .mockResolvedValueOnce([sampleService])
      .mockResolvedValueOnce([{ ...sampleService, is_featured: true }]);

    const wrapper = mount(ServicesAdmin);
    await flushPromises();

    const serviceBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Registro Marcario")
    );
    await serviceBtn.trigger("click");

    const toggleBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Marcar destacado")
    );
    await toggleBtn.trigger("click");
    await flushPromises();

    expect(store.toggleServiceFeatured).toHaveBeenCalledWith(1);
  });
});
