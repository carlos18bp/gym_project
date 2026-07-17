import { mount } from "@vue/test-utils";
import { reactive, nextTick } from "vue";

let mockStore;
jest.mock("@/stores/legal/intranet_gym", () => ({
  useIntranetGymStore: () => mockStore,
}));

const mockShowNotification = jest.fn().mockResolvedValue(undefined);
jest.mock("@/shared/notification_message", () => ({
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("vue-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import IntranetGyM from "@/views/intranet_g_y_m/IntranetGyM.vue";

const stubs = {
  ModuleHeader: { name: "ModuleHeader", props: ["title"], template: "<header><slot name='menu-button' /></header>" },
  ModalTransition: { name: "ModalTransition", template: "<div class='modal-transition'><slot /></div>" },
  FacturationForm: { name: "FacturationForm", emits: ["close"], template: "<form data-testid='facturation-form' />" },
  HighlightText: { name: "HighlightText", props: ["text", "query", "highlightClass"], template: "<span>{{ text }}</span>" },
};

const documentsFixture = [
  { name: "Proceso Administrativo", file_url: "https://cdn/docs/proceso%20admin.docx" },
  { name: "Guía Comercial", file_url: "https://cdn/docs/guia.pdf" },
];

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mountView = async () => {
  const wrapper = mount(IntranetGyM, { global: { stubs } });
  await flushPromises();
  return wrapper;
};

describe("views/intranet_g_y_m/IntranetGyM.vue", () => {
  let clickSpy;
  let downloadedNames;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = reactive({
      profile: {},
      lawyers_count: 5,
      legalDocuments: [...documentsFixture],
      init: jest.fn().mockResolvedValue(undefined),
    });
    window.URL.createObjectURL = jest.fn(() => "blob:mock");
    window.URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["x"])),
    });
    downloadedNames = [];
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function () {
        downloadedNames.push(this.download);
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
    delete global.fetch;
  });

  test("initializes the store and lists the legal documents", async () => {
    const wrapper = await mountView();

    expect(mockStore.init).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Proceso Administrativo");
    expect(wrapper.text()).toContain("Guía Comercial");
  });

  test("shows the plural member count", async () => {
    const wrapper = await mountView();

    expect(wrapper.text()).toContain("5 miembros");
  });

  test("shows the singular member label for one lawyer", async () => {
    mockStore.lawyers_count = 1;
    const wrapper = await mountView();

    expect(wrapper.text()).toContain("1 miembro");
    expect(wrapper.text()).not.toContain("1 miembros");
  });

  test("falls back to stock cover and profile images when the store has none", async () => {
    const wrapper = await mountView();

    const srcs = wrapper.findAll("img").map((i) => i.attributes("src"));
    expect(srcs.some((s) => s.includes("photo-1497366216548"))).toBe(true);
    expect(srcs.some((s) => s.includes("photo-1560179707"))).toBe(true);
  });

  test("uses the store cover and profile images when present", async () => {
    mockStore.profile = {
      cover_image_url: "https://cdn/cover.png",
      profile_image_url: "https://cdn/logo.png",
    };
    const wrapper = await mountView();

    const srcs = wrapper.findAll("img").map((i) => i.attributes("src"));
    expect(srcs).toContain("https://cdn/cover.png");
    expect(srcs).toContain("https://cdn/logo.png");
  });

  test("filters the document list from the search input", async () => {
    const wrapper = await mountView();

    await wrapper.get("input#search").setValue("comercial");
    await nextTick();

    expect(wrapper.text()).toContain("Guía Comercial");
    expect(wrapper.text()).not.toContain("Proceso Administrativo");
  });

  test("opens the facturation modal and closes it on the form close event", async () => {
    const wrapper = await mountView();

    const modals = wrapper.findAll(".modal-transition");
    expect(modals[0].isVisible()).toBe(false);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Enviar Informe"))
      .trigger("click");
    expect(modals[0].isVisible()).toBe(true);

    wrapper.findComponent({ name: "FacturationForm" }).vm.$emit("close");
    await nextTick();
    expect(modals[0].isVisible()).toBe(false);
  });

  test("opens and closes the organization chart modal", async () => {
    const wrapper = await mountView();

    const chartModal = wrapper.findAll(".modal-transition")[1];
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Ver Organigrama"))
      .trigger("click");
    expect(chartModal.isVisible()).toBe(true);

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Cerrar")
      .trigger("click");
    expect(chartModal.isVisible()).toBe(false);
  });

  test("downloads a document with a sanitized filename and notifies success", async () => {
    const wrapper = await mountView();

    await wrapper
      .findAll("li button")
      .find((b) => b.text().includes("Guía Comercial"))
      .trigger("click");
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith("https://cdn/docs/guia.pdf");
    expect(downloadedNames).toEqual(["Guia_Comercial.pdf"]);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(mockShowNotification).toHaveBeenCalledWith(
      'Documento "Guía Comercial" descargado exitosamente',
      "success"
    );
  });

  test("keeps the docx extension from percent-encoded urls", async () => {
    const wrapper = await mountView();

    await wrapper
      .findAll("li button")
      .find((b) => b.text().includes("Proceso Administrativo"))
      .trigger("click");
    await flushPromises();

    expect(downloadedNames).toEqual(["Proceso_Administrativo.docx"]);
  });

  test("notifies an error when the document has no file url", async () => {
    mockStore.legalDocuments = [{ name: "Sin archivo", file_url: null }];
    const wrapper = await mountView();

    await wrapper
      .findAll("li button")
      .find((b) => b.text().includes("Sin archivo"))
      .trigger("click");
    await flushPromises();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "No se encontró el archivo para descargar",
      "error"
    );
  });

  test("notifies an error when the download response is not ok", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch.mockResolvedValue({ ok: false });
    const wrapper = await mountView();

    await wrapper.findAll("li button")[0].trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al descargar el documento",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("notifies an error when the fetch itself throws", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch.mockRejectedValue(new Error("offline"));
    const wrapper = await mountView();

    await wrapper.findAll("li button")[0].trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al descargar el documento",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("keeps the raw url segment when percent-decoding fails", async () => {
    mockStore.legalDocuments = [
      { name: "Malformado", file_url: "https://cdn/docs/archivo%E0%A4%A.pdf" },
    ];
    const wrapper = await mountView();

    await wrapper.findAll("li button")[0].trigger("click");
    await flushPromises();

    expect(downloadedNames).toEqual(["Malformado.pdf"]);
    expect(mockShowNotification).toHaveBeenCalledWith(
      'Documento "Malformado" descargado exitosamente',
      "success"
    );
  });

  test.each([[".doc"], [".xlsx"], [".xls"]])(
    "downloads %s files keeping their extension",
    async (ext) => {
      mockStore.legalDocuments = [
        { name: "Planilla", file_url: `https://cdn/docs/archivo${ext}` },
      ];
      const wrapper = await mountView();

      await wrapper.findAll("li button")[0].trigger("click");
      await flushPromises();

      expect(downloadedNames).toEqual([`Planilla${ext}`]);
    }
  );

  test("falls back to 'documento' when the document name sanitizes to nothing", async () => {
    mockStore.legalDocuments = [{ name: "···", file_url: "https://cdn/docs/x.pdf" }];
    const wrapper = await mountView();

    await wrapper.findAll("li button")[0].trigger("click");
    await flushPromises();

    expect(downloadedNames).toEqual(["documento.pdf"]);
  });

  test("defaults to documento.docx when the url has no filename and the doc no name", async () => {
    mockStore.legalDocuments = [{ name: "", file_url: "https://cdn/docs/" }];
    const wrapper = await mountView();

    await wrapper.findAll("li button")[0].trigger("click");
    await flushPromises();

    expect(downloadedNames).toEqual(["documento.docx"]);
  });
});
