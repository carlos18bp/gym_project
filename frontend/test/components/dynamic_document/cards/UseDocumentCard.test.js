import { mount } from "@vue/test-utils";

import UseDocumentCard from "@/components/dynamic_document/cards/UseDocumentCard.vue";

const mockOpenPreviewModal = jest.fn();

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  openPreviewModal: (...args) => mockOpenPreviewModal(...args),
}));

jest.mock("@/shared/color_palette.js", () => ({
  __esModule: true,
  getColorById: () => ({ dark: "#4527A0" }),
  getColorStyles: () => ({}),
}));

const BaseDocumentCardStub = {
  name: "BaseDocumentCard",
  props: [
    "document",
    "menuOptions",
    "disableInternalActions",
    "showMenuOptions",
    "cardType",
    "cardContext",
    "additionalClasses",
  ],
  emits: ["click", "menuAction", "remove-from-folder", "refresh"],
  template: `
    <div>
      <div data-test="title">{{ document.title }}</div>
      <div data-test="additional-classes">{{ additionalClasses }}</div>
      <button type="button" data-test="card-click" @click="$emit('click', document, {})">card-click</button>
      <button type="button" data-test="menu-use" @click="$emit('menuAction', 'use', document)">menu-use</button>
      <button type="button" data-test="menu-preview" @click="$emit('menuAction', 'preview', document)">menu-preview</button>
      <slot name="footer" />
      <slot name="additional-actions" />
    </div>
  `,
};

const UseDocumentByClientStub = {
  name: "UseDocumentByClient",
  props: ["documentId"],
  emits: ["close"],
  template: "<div data-test='use-modal'><button data-test='close-modal' @click=\"$emit('close', {})\">close</button></div>",
};

describe("UseDocumentCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses default menu options (Usar + Previsualización)", () => {
    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 1, title: "Doc", state: "Published" },
        cardType: "default",
        cardContext: "list",
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);
    const options = base.props("menuOptions");

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Usar", action: "use" }),
        expect.objectContaining({ label: "Previsualización", action: "preview" }),
      ])
    );
  });

  test("uses provided menuOptions prop when passed", () => {
    const customOptions = [{ label: "Custom", action: "custom" }];

    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 1, title: "Doc", state: "Published" },
        menuOptions: customOptions,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);
    expect(base.props("menuOptions")).toEqual(customOptions);
  });

  test("cardAdditionalClasses merges base classes with additionalClasses prop", () => {
    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 1, title: "Doc", state: "Published" },
        additionalClasses: "extra-class",
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);
    const classes = base.props("additionalClasses");
    expect(classes).toContain("!border-purple-400");
    expect(classes).toContain("extra-class");
  });

  test("when disableInternalActions=true, card click emits click and does not open modal", async () => {
    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 1, title: "Doc", state: "Published" },
        disableInternalActions: true,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='card-click']").trigger("click");

    expect(wrapper.emitted("click")).toBeTruthy();
    expect(wrapper.find("[data-test='use-modal']").exists()).toBe(false);
  });

  test("when disableInternalActions=false, card click opens internal modal (no click emit)", async () => {
    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 7, title: "Doc", state: "Published" },
        disableInternalActions: false,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='card-click']").trigger("click");

    expect(wrapper.emitted("click")).toBeFalsy();
    expect(wrapper.find("[data-test='use-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='close-modal']").trigger("click");
    expect(wrapper.find("[data-test='use-modal']").exists()).toBe(false);
  });

  test("menu preview calls openPreviewModal with the document", async () => {
    const doc = { id: 1, title: "Doc", state: "Published" };

    const wrapper = mount(UseDocumentCard, {
      props: {
        document: doc,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='menu-preview']").trigger("click");

    expect(mockOpenPreviewModal).toHaveBeenCalledWith(doc);
  });

  test("unknown menu action logs warning", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 1, title: "Doc", state: "Published" },
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    wrapper.findComponent(BaseDocumentCardStub).vm.$emit("menuAction", "unknown", { id: 1 });

    expect(warnSpy).toHaveBeenCalledWith("Unknown menu action:", "unknown");

    warnSpy.mockRestore();
  });

  test("menu use opens internal modal", async () => {
    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 10, title: "Doc", state: "Published" },
        disableInternalActions: false,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='menu-use']").trigger("click");

    expect(wrapper.find("[data-test='use-modal']").exists()).toBe(true);
  });

  test("openUseModal logs error when document id is missing", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: null, title: "Doc", state: "Published" },
        disableInternalActions: false,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: UseDocumentByClientStub,
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='card-click']").trigger("click");

    expect(consoleSpy).toHaveBeenCalled();
    expect(wrapper.find("[data-test='use-modal']").exists()).toBe(false);

    consoleSpy.mockRestore();
  });

  test("handleModalClose emits document-created and calls forceDocumentHighlight on dashboard", async () => {
    jest.useFakeTimers();

    const historySpy = jest.spyOn(window.history, "pushState");
    window.history.pushState({}, "", "/dynamic_document_dashboard");

    const mockForceDocumentHighlight = jest.fn();
    window.forceDocumentHighlight = mockForceDocumentHighlight;

    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 11, title: "Doc", state: "Published" },
        disableInternalActions: false,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: {
            ...UseDocumentByClientStub,
            template:
              "<div data-test='use-modal'><button data-test='close-modal' @click=\"$emit('close', { updatedDocId: 123 })\">close</button></div>",
          },
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='card-click']").trigger("click");
    await wrapper.find("[data-test='close-modal']").trigger("click");

    expect(wrapper.emitted("document-created")).toBeTruthy();
    expect(wrapper.emitted("document-created")[0][0]).toEqual({ updatedDocId: 123 });

    jest.advanceTimersByTime(100);

    expect(mockForceDocumentHighlight).toHaveBeenCalledWith(123);

    historySpy.mockRestore();
    jest.useRealTimers();
  });

  test("handleModalClose redirects when not on dashboard", async () => {
    jest.useFakeTimers();

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/other", href: "http://localhost/other" },
    });

    const wrapper = mount(UseDocumentCard, {
      props: {
        document: { id: 12, title: "Doc", state: "Published" },
        disableInternalActions: false,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
          UseDocumentByClient: {
            ...UseDocumentByClientStub,
            template:
              "<div data-test='use-modal'><button data-test='close-modal' @click=\"$emit('close', { updatedDocId: 456 })\">close</button></div>",
          },
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("[data-test='card-click']").trigger("click");
    await wrapper.find("[data-test='close-modal']").trigger("click");

    jest.advanceTimersByTime(500);

    expect(window.location.href).toBe("/dynamic_document_dashboard");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });

    jest.useRealTimers();
  });
});
