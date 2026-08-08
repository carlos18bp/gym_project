import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";

const mockShowNotification = jest.fn().mockResolvedValue(undefined);
const mockRouterPush = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: jest.fn(),
  create_request: jest.fn(),
  update_request: jest.fn(),
}));

let mockRoute;
jest.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@tinymce/tinymce-vue", () => ({
  __esModule: true,
  default: {
    name: "Editor",
    props: ["apiKey", "cloudChannel", "modelValue", "init"],
    emits: ["update:modelValue"],
    template: "<div data-testid='tinymce-stub' />",
  },
}));

import DocumentEditor from "@/views/dynamic_document/DocumentEditor.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Minimal TinyMCE editor double: captures buttons and event handlers. */
function buildFakeEditor(initialContent = "") {
  let content = initialContent;
  const buttons = {};
  const handlers = {};
  const editor = {
    ui: {
      registry: {
        addButton: jest.fn((name, spec) => {
          buttons[name] = spec;
        }),
      },
    },
    on: jest.fn((event, handler) => {
      (handlers[event] = handlers[event] || []).push(handler);
    }),
    fire: (event, arg) => (handlers[event] || []).map((h) => h(arg)),
    getContent: jest.fn(() => content),
    setContent: jest.fn((c) => {
      content = c;
    }),
    selection: {
      getNode: jest.fn(() => ({ classList: { contains: () => false }, closest: () => null })),
      getContent: jest.fn(() => ""),
      getRng: jest.fn(() => ({ commonAncestorContainer: null })),
      select: jest.fn(),
      collapse: jest.fn(),
    },
    dom: {
      select: jest.fn(() => []),
      create: jest.fn(() => ({})),
      insertAfter: jest.fn(),
    },
    getBody: jest.fn(() => ({})),
  };
  return { editor, buttons, handlers };
}

function setupStores({ role = "lawyer", isStaff = false, document: doc } = {}) {
  const docStore = useDynamicDocumentStore();
  const userStore = useUserStore();

  userStore.currentUser = {
    id: 10,
    first_name: "Test",
    last_name: "User",
    email: "t@t.com",
    role,
    is_staff: isStaff,
  };

  const mockDoc = doc || {
    id: 7,
    title: "Doc Editor",
    content: "<p>Hola {{Nombre}}</p>",
    state: "Progress",
    assigned_to: 10,
    variables: [
      { name_en: "Nombre", name_es: "Nombre ES", field_type: "input", value: "Ana", tooltip: "t" },
    ],
    tags: [],
  };

  jest.spyOn(docStore, "fetchDocumentById").mockResolvedValue(mockDoc);
  jest.spyOn(docStore, "createDocument").mockResolvedValue({ id: 99 });
  jest.spyOn(docStore, "updateDocument").mockResolvedValue({ id: mockDoc.id });
  jest.spyOn(docStore, "init").mockResolvedValue();

  return { docStore, userStore, mockDoc };
}

async function mountEditor(pinia) {
  const wrapper = mount(DocumentEditor, { global: { plugins: [pinia] } });
  await flushPromises();
  return wrapper;
}

function editorProps(wrapper) {
  return wrapper.findComponent({ name: "Editor" }).props();
}

describe("views/dynamic_document/DocumentEditor.vue", () => {
  let pinia;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    mockRoute = {
      params: { id: "7", title: "Doc Editor" },
      path: "/dynamic_document_dashboard/lawyer/editor/edit/7",
    };
  });

  describe("carga y roles", () => {
    test("lawyers see the raw template content with {{variables}}", async () => {
      const { docStore } = setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);

      expect(docStore.fetchDocumentById).toHaveBeenCalledWith("7", true);
      expect(editorProps(wrapper).modelValue).toBe("<p>Hola {{Nombre}}</p>");
    });

    test("clients on the client editor route get protected variable spans with values", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      setupStores({ role: "client" });
      const wrapper = await mountEditor(pinia);

      const content = editorProps(wrapper).modelValue;
      expect(content).toContain("variable-protected");
      expect(content).toContain("Ana");
      expect(content).not.toContain("{{Nombre}}");
    });

    test("staff users with stale client role are still treated as lawyers", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      setupStores({ role: "client", isStaff: true });
      const wrapper = await mountEditor(pinia);

      expect(editorProps(wrapper).modelValue).toBe("<p>Hola {{Nombre}}</p>");
    });

    test("basic users never get the client protection treatment", async () => {
      setupStores({ role: "basic" });
      const wrapper = await mountEditor(pinia);

      expect(editorProps(wrapper).modelValue).toBe("<p>Hola {{Nombre}}</p>");
    });

    test("falls back to the store document when the fetch fails", async () => {
      const { docStore, mockDoc } = setupStores({ role: "lawyer" });
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      docStore.fetchDocumentById.mockRejectedValue(new Error("api down"));
      const documentById = jest.fn().mockResolvedValue(mockDoc);
      Object.defineProperty(docStore, "documentById", { value: documentById, configurable: true });

      const wrapper = await mountEditor(pinia);

      expect(documentById).toHaveBeenCalledWith("7");
      expect(editorProps(wrapper).modelValue).toBe("<p>Hola {{Nombre}}</p>");
      errorSpy.mockRestore();
    });
  });

  describe("configuración del editor", () => {
    test("client editors hide the continue button and enable noneditable protection", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      setupStores({ role: "corporate_client" });
      const wrapper = await mountEditor(pinia);

      const init = editorProps(wrapper).init;
      expect(init.toolbar).toContain("save return");
      expect(init.toolbar).not.toContain("continue");
      expect(init.noneditable_noneditable_class).toBe("variable-protected");
    });

    test("lawyer editors expose the continue slot and table tools", async () => {
      setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);

      const init = editorProps(wrapper).init;
      expect(init.toolbar).toContain("save continue return");
      expect(init.toolbar).toContain("tablemergecells");
      expect(init.noneditable_noneditable_class).toBeUndefined();
    });

    test("setup registers save/continue/return buttons with role-aware labels", async () => {
      setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);

      expect(Object.keys(buttons).sort()).toEqual(["continue", "return", "save"]);
      expect(buttons.save.text).toBe("Guardar como borrador");
    });

    test("client setup labels the save button Guardar", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      setupStores({ role: "client" });
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);

      expect(buttons.save.text).toBe("Guardar");
    });

    test("paste_postprocess strips mso styles and Word classes", async () => {
      setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);

      const node = document.createElement("div");
      node.innerHTML =
        '<p style="mso-line-height-rule:exactly;color:red;">x</p><p class="MsoNormal">y</p>';

      editorProps(wrapper).init.paste_postprocess(null, { node });

      const [styled, classed] = node.querySelectorAll("p");
      expect(styled.getAttribute("style")).not.toContain("mso-");
      expect(styled.getAttribute("style")).toContain("color:red");
      expect(classed.hasAttribute("class")).toBe(false);
    });
  });

  describe("acciones de guardado y navegación", () => {
    test("return button navigates back to the dashboard", async () => {
      setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      buttons.return.onAction();

      expect(mockRouterPush).toHaveBeenCalledWith("/dynamic_document_dashboard");
    });

    test("continue with empty content warns and stays", async () => {
      setupStores({ role: "lawyer", document: { id: 7, title: "t", content: "<p>&nbsp;</p>", variables: [], tags: [] } });
      const wrapper = await mountEditor(pinia);
      await wrapper.findComponent({ name: "Editor" }).vm.$emit("update:modelValue", "<p>   </p>");

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.continue.onAction();
      await flushPromises();

      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining("documento vacío"),
        "warning"
      );
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    test("continue syncs extracted variables keeping existing metadata and navigates", async () => {
      const { docStore } = setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);
      await wrapper
        .findComponent({ name: "Editor" })
        .vm.$emit("update:modelValue", "<p>{{Nombre}} y {{Fecha}}</p>");

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.continue.onAction();
      await flushPromises();

      const names = docStore.selectedDocument.variables.map((v) => v.name_en);
      expect(names).toEqual(["Nombre", "Fecha"]);
      const kept = docStore.selectedDocument.variables[0];
      expect(kept.name_es).toBe("Nombre ES");
      expect(kept.value).toBe("Ana");
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/dynamic_document_dashboard/lawyer/variables-config"
      );
    });

    test("draft save with empty content warns without hitting the API", async () => {
      const { docStore } = setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);
      await wrapper.findComponent({ name: "Editor" }).vm.$emit("update:modelValue", "");

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining("documento vacío"),
        "warning"
      );
      expect(docStore.updateDocument).not.toHaveBeenCalled();
      expect(docStore.createDocument).not.toHaveBeenCalled();
    });

    test("draft save updates the existing document and records the highlight id", async () => {
      const { docStore } = setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);
      await wrapper
        .findComponent({ name: "Editor" })
        .vm.$emit("update:modelValue", "<p>Borrador {{Nombre}}</p>");

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(docStore.updateDocument).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ state: "Draft", content: "<p>Borrador {{Nombre}}</p>" })
      );
      expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("7");
      expect(mockShowNotification).toHaveBeenCalledWith(
        "¡Borrador guardado exitosamente!",
        "success"
      );
    });

    test("client save on a template creates a Progress copy assigned to the user", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const template = {
        id: 7,
        title: "Plantilla",
        content: "<p>Hola {{Nombre}}</p>",
        state: "Published",
        assigned_to: null,
        variables: [
          { name_en: "Nombre", name_es: "Nombre ES", field_type: "input", value: "Ana" },
        ],
        tags: [{ id: 3 }],
      };
      const { docStore } = setupStores({ role: "client", document: template });
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(docStore.createDocument).toHaveBeenCalledTimes(1);
      const payload = docStore.createDocument.mock.calls[0][0];
      expect(payload.state).toBe("Progress");
      expect(payload.assigned_to).toBe(10);
      expect(payload.tag_ids).toEqual([3]);
      expect(payload.content).toContain("{{Nombre}}");
      expect(payload.content).not.toContain("variable-protected");
      expect(mockShowNotification).toHaveBeenCalledWith(
        "Documento creado exitosamente desde la plantilla.",
        "success"
      );
    });

    test("client save on their own document updates it in place", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const own = {
        id: 7,
        title: "Mi doc",
        content: "<p>Hola {{Nombre}}</p>",
        state: "Progress",
        assigned_to: 10,
        variables: [
          { name_en: "Nombre", name_es: "Nombre ES", field_type: "input", value: "Ana" },
        ],
        tags: [],
      };
      const { docStore } = setupStores({ role: "client", document: own });
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(docStore.updateDocument).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ id: 7 })
      );
      expect(docStore.createDocument).not.toHaveBeenCalled();
    });

    test("client save without an identifiable user aborts with an error", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const { docStore, userStore } = setupStores({ role: "client" });
      const wrapper = await mountEditor(pinia);
      userStore.currentUser = { role: "client" };

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining("No se pudo identificar al usuario"),
        "error"
      );
      expect(docStore.createDocument).not.toHaveBeenCalled();
    });
  });

  describe("protección de variables (cliente)", () => {
    async function mountClientWithFakeEditor() {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const stores = setupStores({ role: "client" });
      const wrapper = await mountEditor(pinia);
      const fake = buildFakeEditor(editorProps(wrapper).init ? editorProps(wrapper).modelValue : "");
      editorProps(wrapper).init.setup(fake.editor);
      return { wrapper, ...stores, ...fake };
    }

    test("input restores the content when a protected span disappears", async () => {
      const { editor, handlers } = await mountClientWithFakeEditor();
      jest.useFakeTimers();

      editor.getContent.mockReturnValue("<p>sin spans</p>");
      handlers.input.forEach((h) => h());
      jest.runAllTimers();

      expect(editor.setContent).toHaveBeenCalledWith(
        expect.stringContaining("variable-protected")
      );
    });

    test("keydown Backspace over a protected variable is blocked", async () => {
      const { editor, handlers } = await mountClientWithFakeEditor();
      const protectedNode = {
        classList: { contains: (c) => c === "variable-protected" },
        closest: () => null,
        nextSibling: {},
      };
      editor.selection.getNode.mockReturnValue(protectedNode);

      const event = {
        key: "Backspace",
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      };
      handlers.keydown.forEach((h) => h(event));

      expect(event.preventDefault).toHaveBeenCalled();
    });

    test("paste over a protected variable is blocked", async () => {
      const { editor, handlers } = await mountClientWithFakeEditor();
      editor.selection.getContent.mockReturnValue(
        '<span class="variable-protected">Ana</span>'
      );

      const event = { preventDefault: jest.fn() };
      handlers.paste.forEach((h) => h(event));

      expect(event.preventDefault).toHaveBeenCalled();
    });

    test("lawyer editors do not register the protection handlers", async () => {
      setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);

      const { editor, handlers } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);

      expect(handlers.keydown).toBeUndefined();
      expect(handlers.paste).toBeUndefined();
    });
  });
});

describe("views/dynamic_document/DocumentEditor.vue — handlers profundos", () => {
  let pinia;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    mockRoute = {
      params: { id: "7", title: "Doc Editor" },
      path: "/dynamic_document_dashboard/lawyer/editor/edit/7",
    };
  });

  async function mountAs(role, path = null, doc = undefined) {
    if (path) mockRoute.path = path;
    const stores = setupStores({ role, document: doc });
    const wrapper = await mountEditor(pinia);
    const fake = buildFakeEditor();
    editorProps(wrapper).init.setup(fake.editor);
    return { wrapper, ...stores, ...fake };
  }

  test("client fetch failure still renders protected values from the store fallback", async () => {
    mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
    const { docStore, mockDoc } = setupStores({ role: "client" });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    docStore.fetchDocumentById.mockRejectedValue(new Error("api down"));
    Object.defineProperty(docStore, "documentById", {
      value: jest.fn().mockResolvedValue(mockDoc),
      configurable: true,
    });

    const wrapper = await mountEditor(pinia);

    expect(editorProps(wrapper).modelValue).toContain("variable-protected");
    errorSpy.mockRestore();
  });

  test("draft save without an existing id creates the document", async () => {
    mockRoute.params = { title: "Nuevo Título" };
    const { docStore, wrapper, buttons } = await (async () => {
      const stores = setupStores({ role: "lawyer" });
      stores.docStore.fetchDocumentById.mockResolvedValue(null);
      mockRoute.params.id = undefined;
      const wrapper = mount(DocumentEditor, { global: { plugins: [pinia] } });
      await flushPromises();
      const fake = buildFakeEditor();
      editorProps(wrapper).init.setup(fake.editor);
      return { ...stores, wrapper, ...fake };
    })();
    await wrapper
      .findComponent({ name: "Editor" })
      .vm.$emit("update:modelValue", "<p>Contenido nuevo</p>");

    await buttons.save.onAction();
    await flushPromises();

    expect(docStore.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ state: "Draft", content: "<p>Contenido nuevo</p>" })
    );
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("99");
  });

  test("draft save recovers the id by title when the API returns none", async () => {
    const { docStore, wrapper, buttons } = await (async () => {
      const stores = setupStores({ role: "lawyer" });
      stores.docStore.fetchDocumentById.mockResolvedValue(null);
      mockRoute.params.id = undefined;
      stores.docStore.createDocument.mockResolvedValue({});
      const wrapper = mount(DocumentEditor, { global: { plugins: [pinia] } });
      await flushPromises();
      const fake = buildFakeEditor();
      editorProps(wrapper).init.setup(fake.editor);
      return { ...stores, wrapper, ...fake };
    })();
    await wrapper
      .findComponent({ name: "Editor" })
      .vm.$emit("update:modelValue", "<p>Recuperable</p>");
    docStore.init.mockImplementation(async () => {
      docStore.documents = [
        { id: 55, title: "Doc Editor", content: "<p>Recuperable</p>", state: "Draft" },
      ];
    });

    await buttons.save.onAction();
    await flushPromises();

    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("55");
  });

  test("draft save failures are reported", async () => {
    const { docStore, wrapper, buttons } = await mountAs("lawyer");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await wrapper
      .findComponent({ name: "Editor" })
      .vm.$emit("update:modelValue", "<p>x</p>");
    docStore.updateDocument.mockRejectedValue(new Error("api down"));

    await buttons.save.onAction();
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al guardar el borrador.",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("continue without a selected document builds one from the route title", async () => {
    const { docStore, wrapper, buttons } = await (async () => {
      const stores = setupStores({ role: "lawyer" });
      stores.docStore.fetchDocumentById.mockResolvedValue(null);
      mockRoute.params = { title: "Desde Ruta" };
      const wrapper = mount(DocumentEditor, { global: { plugins: [pinia] } });
      await flushPromises();
      const fake = buildFakeEditor();
      editorProps(wrapper).init.setup(fake.editor);
      return { ...stores, wrapper, ...fake };
    })();
    await wrapper
      .findComponent({ name: "Editor" })
      .vm.$emit("update:modelValue", "<p>{{Var}}</p>");

    await buttons.continue.onAction();

    expect(docStore.selectedDocument.title).toBe("Desde Ruta");
    expect(docStore.selectedDocument.variables[0].name_en).toBe("Var");
    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/lawyer/variables-config"
    );
  });

  test("client save reports create failures without id", async () => {
    const template = {
      id: 7,
      title: "Plantilla",
      content: "<p>Hola {{Nombre}}</p>",
      state: "Published",
      assigned_to: null,
      variables: [{ name_en: "Nombre", name_es: "", field_type: "input", value: "Ana" }],
      tags: [],
    };
    const { docStore, buttons } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7",
      template
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    docStore.createDocument.mockResolvedValue({});

    await buttons.save.onAction();
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error: No se pudo crear el documento.",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("client save failures fall into the generic error path", async () => {
    const { docStore, buttons } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    docStore.updateDocument.mockRejectedValue(new Error("api down"));

    await buttons.save.onAction();
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al guardar el documento.",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("init enforces Carlito on content missing the font", async () => {
    const { editor, handlers } = await mountAs("lawyer");
    jest.useFakeTimers();
    editor.getContent.mockReturnValue("<p>x</p>");

    handlers.init.forEach((h) => h());
    jest.runAllTimers();

    expect(editor.setContent).toHaveBeenCalledWith(
      expect.stringContaining("Carlito")
    );
  });

  test("BeforeSetContent injects and normalizes font-family declarations", async () => {
    const { handlers } = await mountAs("lawyer");

    const withStyle = { content: '<p style="color:red;">x</p>' };
    handlers.BeforeSetContent.forEach((h) => h(withStyle));
    expect(withStyle.content).toContain("font-family: 'Carlito'");

    const withFont = { content: '<p style="font-family: Arial;">x</p>' };
    handlers.BeforeSetContent.forEach((h) => h(withFont));
    expect(withFont.content).toContain("font-family: 'Carlito'");
    expect(withFont.content).not.toContain("Arial");
  });

  test("SetContent on paste re-enforces Carlito asynchronously", async () => {
    const { editor, handlers } = await mountAs("lawyer");
    jest.useFakeTimers();
    editor.getContent.mockReturnValue("<p>pegado</p>");

    handlers.SetContent.forEach((h) => h({ paste: true }));
    jest.runAllTimers();

    expect(editor.setContent).toHaveBeenCalledWith(
      expect.stringContaining("Carlito"),
      { format: "raw", no_events: true }
    );
  });

  test("paste_postprocess ignores events without a node", async () => {
    setupStores({ role: "lawyer" });
    const wrapper = await mountEditor(pinia);

    expect(() =>
      editorProps(wrapper).init.paste_postprocess(null, { node: null })
    ).not.toThrow();
  });

  test("protectVariables hardens every protected span after SetContent", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    jest.useFakeTimers();
    const span = document.createElement("span");
    span.className = "variable-protected";
    editor.dom.select.mockReturnValue([span]);

    handlers.SetContent.forEach((h) => h({}));
    jest.runAllTimers();

    expect(span.getAttribute("contenteditable")).toBe("false");
    expect(span.title).toContain("Variable protegida");
    expect(span.style.pointerEvents).toBe("none");
  });

  test("keydown creates a landing space when the protected span has no sibling", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    const protectedNode = {
      classList: { contains: (c) => c === "variable-protected" },
      closest: () => null,
      nextSibling: null,
    };
    editor.selection.getNode.mockReturnValue(protectedNode);
    const space = {};
    editor.dom.create.mockReturnValue(space);

    const event = { key: "Delete", preventDefault: jest.fn(), stopPropagation: jest.fn() };
    handlers.keydown.forEach((h) => h(event));

    expect(editor.dom.insertAfter).toHaveBeenCalledWith(space, protectedNode);
    expect(editor.selection.select).toHaveBeenCalledWith(space);
  });

  test("keydown blocks typing inside a protected span but allows arrows", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    const protectedNode = {
      classList: { contains: (c) => c === "variable-protected" },
      closest: () => null,
      nextSibling: {},
    };
    editor.selection.getNode.mockReturnValue(protectedNode);

    const typing = { key: "a", preventDefault: jest.fn(), stopPropagation: jest.fn() };
    handlers.keydown.forEach((h) => h(typing));
    expect(typing.preventDefault).toHaveBeenCalled();

    const arrow = { key: "ArrowRight", preventDefault: jest.fn(), stopPropagation: jest.fn() };
    handlers.keydown.forEach((h) => h(arrow));
    expect(arrow.preventDefault).not.toHaveBeenCalled();
  });

  test("input with intact spans only re-applies protection", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    editor.getContent.mockReturnValue(
      '<p><span class="variable-protected" data-variable="Nombre">Ana</span></p>'
    );
    const span = document.createElement("span");
    editor.dom.select.mockReturnValue([span]);

    handlers.input.forEach((h) => h());

    expect(editor.setContent).not.toHaveBeenCalled();
    expect(span.getAttribute("contenteditable")).toBe("false");
  });

  test("dragstart from a protected span is cancelled", async () => {
    const { handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    const event = {
      target: { classList: { contains: () => true }, closest: () => null },
      preventDefault: jest.fn(),
    };
    handlers.dragstart.forEach((h) => h(event));

    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("selections containing protected content collapse to a safe node", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    editor.selection.getContent.mockReturnValue(
      '<span class="variable-protected">Ana</span>'
    );
    const safeNode = {};
    editor.dom.select.mockReturnValue([safeNode]);

    handlers.selectionchange.forEach((h) => h());

    expect(editor.selection.select).toHaveBeenCalledWith(safeNode);
    expect(editor.selection.collapse).toHaveBeenCalledWith(true);
  });

  test("beforeinput over protected content is blocked", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    editor.selection.getNode.mockReturnValue({
      classList: { contains: () => true },
      closest: () => null,
    });

    const event = { preventDefault: jest.fn() };
    handlers.beforeinput.forEach((h) => h(event));

    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("client init and LoadContent re-protect the rendered spans", async () => {
    const { editor, handlers } = await mountAs(
      "client",
      "/dynamic_document_dashboard/client/editor/edit/7"
    );
    jest.useFakeTimers();
    const span = document.createElement("span");
    editor.dom.select.mockReturnValue([span]);

    handlers.LoadContent.forEach((h) => h());
    jest.runAllTimers();

    expect(span.getAttribute("contenteditable")).toBe("false");
  });

  describe("ramas residuales de guardado", () => {
    test("template copy coerces a string user id into a numeric assigned_to", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const template = {
        id: 7,
        title: "Plantilla",
        content: "<p>Hola {{Nombre}}</p>",
        state: "Published",
        assigned_to: null,
        variables: [{ name_en: "Nombre", name_es: "Nombre ES", field_type: "input", value: "Ana" }],
        tags: [],
      };
      const { docStore, userStore } = setupStores({ role: "client", document: template });
      userStore.currentUser.id = "10";
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(docStore.createDocument.mock.calls[0][0].assigned_to).toBe(10);
    });

    test("template copy without a returned id surfaces a creation error", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const template = {
        id: 7,
        title: "Plantilla",
        content: "<p>Hola {{Nombre}}</p>",
        state: "Published",
        assigned_to: null,
        variables: [{ name_en: "Nombre", name_es: "Nombre ES", field_type: "input", value: "Ana" }],
        tags: [],
      };
      const { docStore } = setupStores({ role: "client", document: template });
      docStore.createDocument.mockResolvedValue({});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const wrapper = await mountEditor(pinia);

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(mockShowNotification).toHaveBeenCalledWith(
        "Error: No se pudo crear el documento.",
        "error"
      );
      errorSpy.mockRestore();
    });

    test("client save without a selected document reports an error", async () => {
      mockRoute.path = "/dynamic_document_dashboard/client/editor/edit/7";
      const { docStore } = setupStores({ role: "client" });
      const wrapper = await mountEditor(pinia);
      docStore.selectedDocument = null;

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      expect(mockShowNotification).toHaveBeenCalledWith(
        "Error: No se encontró el documento para guardar.",
        "error"
      );
      expect(docStore.createDocument).not.toHaveBeenCalled();
      expect(docStore.updateDocument).not.toHaveBeenCalled();
    });

    test("creating a draft from scratch syncs the extracted variables", async () => {
      mockRoute = {
        params: { title: "Nuevo" },
        path: "/dynamic_document_dashboard/lawyer/editor/create/Nuevo",
      };
      const { docStore } = setupStores({ role: "lawyer" });
      const wrapper = await mountEditor(pinia);
      docStore.selectedDocument = null;
      await wrapper
        .findComponent({ name: "Editor" })
        .vm.$emit("update:modelValue", "<p>Draft {{Cliente}}</p>");

      const { editor, buttons } = buildFakeEditor();
      editorProps(wrapper).init.setup(editor);
      await buttons.save.onAction();
      await flushPromises();

      const payload = docStore.createDocument.mock.calls[0][0];
      expect(payload.state).toBe("Draft");
      expect(payload.variables.map((v) => v.name_en)).toEqual(["Cliente"]);
      expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("99");
    });
  });
});
