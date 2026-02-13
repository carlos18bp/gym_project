import { mount } from "@vue/test-utils";

import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
}));

describe("DocumentPreviewModal.vue", () => {
  test("renders title and content when visible", () => {
    const wrapper = mount(DocumentPreviewModal, {
      props: {
        isVisible: true,
        documentData: {
          title: "Contrato de Prueba",
          content: "<p>Contenido HTML</p>",
        },
      },
      global: {
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    expect(wrapper.text()).toContain("Previsualización del Documento: Contrato de Prueba");
    expect(wrapper.html()).toContain("<p>Contenido HTML</p>");
  });

  test("emits close when clicking the close button", async () => {
    const wrapper = mount(DocumentPreviewModal, {
      props: {
        isVisible: true,
        documentData: { title: "Doc", content: "" },
      },
      global: {
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
        },
      },
    });

    await wrapper.find("button").trigger("click");

    expect(wrapper.emitted().close).toBeTruthy();
  });
});
