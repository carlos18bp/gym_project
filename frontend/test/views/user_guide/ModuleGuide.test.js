import { mount } from "@vue/test-utils";

const mockGetModuleContent = jest.fn();

jest.mock("@/stores/user_guide", () => ({
  useUserGuideStore: () => ({
    getModuleContent: mockGetModuleContent,
  }),
}));

jest.mock("@/composables/useSafeHtml.js", () => ({
  sanitizeHtml: (html) => html || "",
}));

import ModuleGuide from "@/views/user_guide/components/ModuleGuide.vue";

const ExampleModalStub = {
  name: "ExampleModal",
  props: ["open", "example"],
  template: "<div data-testid='example-modal-stub' :data-open='open' />",
};

const moduleFixture = {
  name: "Documentos",
  description: "Gestión de archivos jurídicos.",
  overview: "<p>OVERVIEW-HTML</p>",
  sections: [
    {
      id: "editor",
      name: "Editor",
      description: "Cómo usar el editor.",
      content: "<p>SECTION-HTML</p>",
      features: ["Variables dinámicas"],
      steps: [{ title: "Abrir", description: "Desde el dashboard." }],
      example: { title: "Ejemplo editor", description: "", steps: [] },
      tips: ["Guarda seguido."],
      restrictions: ["Solo abogados publican."],
    },
    { id: "firmas", name: "Firmas", description: "Flujo de firmas." },
  ],
};

const mountGuide = (props = {}) =>
  mount(ModuleGuide, {
    props: { module: "documents", role: "lawyer", ...props },
    global: { stubs: { ExampleModal: ExampleModalStub } },
  });

describe("views/user_guide/components/ModuleGuide.vue", () => {
  beforeEach(() => {
    mockGetModuleContent.mockReset();
    mockGetModuleContent.mockReturnValue(moduleFixture);
  });

  test("renders the module name and description from the store", () => {
    const wrapper = mountGuide();

    expect(mockGetModuleContent).toHaveBeenCalledWith("documents", "lawyer");
    expect(wrapper.text()).toContain("Documentos");
    expect(wrapper.text()).toContain("Gestión de archivos jurídicos.");
  });

  test("shows the module overview and section cards when no section is selected", () => {
    const wrapper = mountGuide();

    expect(wrapper.html()).toContain("OVERVIEW-HTML");
    expect(wrapper.text()).toContain("Secciones Disponibles:");
    expect(wrapper.text()).toContain("Firmas");
  });

  test("emits section-selected with the section id when a section card is clicked", async () => {
    const wrapper = mountGuide();

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Firmas"))
      .trigger("click");

    expect(wrapper.emitted("section-selected")).toEqual([["firmas"]]);
  });

  test("renders the section content when a section is selected", () => {
    const wrapper = mountGuide({ section: "editor" });

    expect(wrapper.text()).toContain("Editor");
    expect(wrapper.html()).toContain("SECTION-HTML");
    expect(wrapper.text()).not.toContain("Secciones Disponibles:");
  });

  test("emits section-selected null from the back button", async () => {
    const wrapper = mountGuide({ section: "editor" });

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Volver al módulo"))
      .trigger("click");

    expect(wrapper.emitted("section-selected")).toEqual([[null]]);
  });

  test("lists section features when present", () => {
    const wrapper = mountGuide({ section: "editor" });

    expect(wrapper.text()).toContain("Funcionalidades:");
    expect(wrapper.text()).toContain("Variables dinámicas");
  });

  test("renders numbered steps with the example button", () => {
    const wrapper = mountGuide({ section: "editor" });

    expect(wrapper.text()).toContain("Paso a Paso:");
    expect(wrapper.text()).toContain("Abrir");
    expect(wrapper.text()).toContain("Ver Ejemplo Completo");
  });

  test("opens the example modal when the example button is clicked", async () => {
    const wrapper = mountGuide({ section: "editor" });

    expect(wrapper.get("[data-testid='example-modal-stub']").attributes("data-open")).toBe("false");

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Ver Ejemplo Completo"))
      .trigger("click");

    expect(wrapper.get("[data-testid='example-modal-stub']").attributes("data-open")).toBe("true");
  });

  test("shows tips and restrictions blocks when present", () => {
    const wrapper = mountGuide({ section: "editor" });

    expect(wrapper.text()).toContain("Consejos:");
    expect(wrapper.text()).toContain("Guarda seguido.");
    expect(wrapper.text()).toContain("Restricciones:");
    expect(wrapper.text()).toContain("Solo abogados publican.");
  });

  test("falls back to the overview when the selected section does not exist", () => {
    const wrapper = mountGuide({ section: "inexistente" });

    expect(wrapper.html()).toContain("OVERVIEW-HTML");
  });

  test("renders without crashing when the store has no content for the module", () => {
    mockGetModuleContent.mockReturnValue(null);
    const wrapper = mountGuide({ section: "editor" });

    expect(wrapper.text()).not.toContain("Volver al módulo");
    expect(wrapper.text()).not.toContain("Secciones Disponibles:");
  });

  test("renders the overview without section cards when the module has none", () => {
    mockGetModuleContent.mockReturnValue({ ...moduleFixture, sections: undefined });
    const wrapper = mountGuide();

    expect(wrapper.html()).toContain("OVERVIEW-HTML");
    expect(wrapper.text()).not.toContain("Secciones Disponibles:");
  });
});
