import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useReportsStore } from "@/stores/dashboard/reports";

import ReportsWidget from "@/components/dashboard/widgets/ReportsWidget.vue";

const flushPromises = async () => {
  await Promise.resolve();
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("ReportsWidget.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("disables button until report type is selected and validates date range", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const reportsStore = useReportsStore();
    jest.spyOn(reportsStore, "generateExcelReport").mockResolvedValue(new Blob([]));

    const wrapper = mount(ReportsWidget, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        plugins: [pinia],
      },
    });

    const button = wrapper.find("button");
    expect(button.attributes("disabled")).toBeDefined();

    await wrapper.find("#reportType").setValue("active_processes");
    await flushPromises();

    expect(wrapper.find("button").attributes("disabled")).toBeUndefined();

    // Only one date => invalid
    await wrapper.find("#startDate").setValue("2026-01-10");
    await flushPromises();

    expect(wrapper.text()).toContain(
      "Si proporcionas una fecha, debes proporcionar ambas fechas."
    );
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();

    // Both dates but start > end => invalid
    await wrapper.find("#endDate").setValue("2026-01-01");
    await flushPromises();

    expect(wrapper.find("button").attributes("disabled")).toBeDefined();

    // Valid range => enabled
    await wrapper.find("#endDate").setValue("2026-01-31");
    await flushPromises();

    expect(wrapper.find("button").attributes("disabled")).toBeUndefined();
  });

  test("calls reportsStore.generateExcelReport with correct payload and shows processing state", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const reportsStore = useReportsStore();
    const deferred = createDeferred();

    const spy = jest
      .spyOn(reportsStore, "generateExcelReport")
      .mockImplementation(() => deferred.promise);

    const wrapper = mount(ReportsWidget, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await wrapper.find("#reportType").setValue("legal_requests");
    await wrapper.find("#startDate").setValue("2026-01-01");
    await wrapper.find("#endDate").setValue("2026-01-31");

    await wrapper.find("button").trigger("click");
    await wrapper.vm.$nextTick();

    expect(spy).toHaveBeenCalledWith({
      reportType: "legal_requests",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(wrapper.text()).toContain("Procesando...");
    expect(wrapper.text()).toContain("Generando reporte...");

    deferred.resolve(new Blob([]));
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Generar y Descargar Reporte");
  });

  test("alerts when report generation fails", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const reportsStore = useReportsStore();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    jest
      .spyOn(reportsStore, "generateExcelReport")
      .mockRejectedValue(new Error("fail"));

    const wrapper = mount(ReportsWidget, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await wrapper.find("#reportType").setValue("active_processes");
    await wrapper.find("button").trigger("click");

    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith("Error al generar el reporte");

    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("formatDate formats to YYYY-MM-DD with zero padding", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const reportsStore = useReportsStore();
    jest.spyOn(reportsStore, "generateExcelReport").mockResolvedValue(new Blob([]));

    const wrapper = mount(ReportsWidget, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.vm.formatDate(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
    expect(wrapper.vm.formatDate(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09");
  });

  test("generateReport returns early when form is invalid", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const reportsStore = useReportsStore();
    const spy = jest.spyOn(reportsStore, "generateExcelReport").mockResolvedValue(new Blob([]));

    const wrapper = mount(ReportsWidget, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find("button").attributes("disabled")).toBeDefined();

    await wrapper.vm.generateReport();
    await flushPromises();

    expect(spy).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("Procesando...");
  });
});
