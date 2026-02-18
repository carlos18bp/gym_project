import { mount } from "@vue/test-utils";

import DocumentSummaryModal from "@/components/dynamic_document/common/DocumentSummaryModal.vue";

const buildDocument = (overrides = {}) => ({
  id: 1,
  summary_counterparty: "ACME",
  summary_object: "Servicio",
  summary_value: 12000,
  summary_value_currency: "USD",
  summary_term: "12 meses",
  summary_subscription_date: "2026-01-10T00:00:00Z",
  summary_start_date: "2026-01-11T00:00:00Z",
  summary_end_date: "2026-12-31T00:00:00Z",
  ...overrides,
});

describe("DocumentSummaryModal.vue", () => {
  test("renders summary labels", () => {
    const wrapper = mount(DocumentSummaryModal, {
      props: {
        isVisible: true,
        document: buildDocument(),
      },
    });

    expect(wrapper.text()).toContain("Usuario / Contraparte");
    expect(wrapper.text()).toContain("Objeto");
    expect(wrapper.text()).toContain("Plazo");
  });

  test("renders summary values", () => {
    const wrapper = mount(DocumentSummaryModal, {
      props: {
        isVisible: true,
        document: buildDocument(),
      },
    });

    expect(wrapper.text()).toContain("ACME");
    expect(wrapper.text()).toContain("Servicio");
    expect(wrapper.text()).toContain("USD $ 12.000");
    expect(wrapper.text()).toContain("12 meses");
  });

  test("renders summary dates and formats values", () => {
    const wrapper = mount(DocumentSummaryModal, {
      props: {
        isVisible: true,
        document: buildDocument(),
      },
    });

    expect(wrapper.text()).toContain("2026-01-10");
    expect(wrapper.text()).toContain("2026-01-11");
    expect(wrapper.text()).toContain("2026-12-31");
    expect(wrapper.vm.formatDate("2026-02-01T10:00:00Z")).toBe("2026-02-01");
  });

  test("shows empty summary message and emits close", async () => {
    const wrapper = mount(DocumentSummaryModal, {
      props: {
        isVisible: true,
        document: buildDocument({
          summary_counterparty: "",
          summary_object: "",
          summary_value: null,
          summary_term: "",
          summary_subscription_date: null,
          summary_start_date: null,
          summary_end_date: null,
        }),
      },
    });

    expect(wrapper.text()).toContain(
      "Este documento aún no tiene campos clasificados"
    );

    const closeButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Cerrar"));

    await closeButton.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
