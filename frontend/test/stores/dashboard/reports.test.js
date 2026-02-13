import { setActivePinia, createPinia } from "pinia";

import axios from "axios";
import { useReportsStore } from "@/stores/dashboard/reports";

jest.mock("axios");

describe("Reports Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  test("generateExcelReport creates a download and sets lastGeneratedReport", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T10:00:00Z"));

    const store = useReportsStore();

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = () => "blob:mock";
    }

    const createObjectURLSpy = jest.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock");

    axios.post.mockResolvedValue({
      data: new Blob(["xls"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    });

    const reportData = { reportType: "processes", startDate: "2026-01-01", endDate: "2026-01-31", userId: null };

    const result = await store.generateExcelReport(reportData);

    expect(axios.post).toHaveBeenCalledWith(
      "/api/reports/generate-excel/",
      reportData,
      { responseType: "blob" }
    );

    expect(result).toBeTruthy();
    expect(store.isGenerating).toBe(false);
    expect(store.error).toBe(null);

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    expect(store.lastGeneratedReport.type).toBe("processes");
    expect(store.lastGeneratedReport.filename).toBe("processes_2026-01-31.xlsx");

    clickSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    jest.useRealTimers();
  });

  test("generateExcelReport toggles isGenerating while request is pending", async () => {
    const store = useReportsStore();
    const deferred = createDeferred();

    axios.post.mockImplementation(() => deferred.promise);

    const promise = store.generateExcelReport({
      reportType: "processes",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      userId: null,
    });

    expect(store.isGenerating).toBe(true);

    deferred.resolve({ data: new Blob(["xls"]) });
    await promise;

    expect(store.isGenerating).toBe(false);
  });

  test("generateExcelReport appends and removes the download link", async () => {
    const store = useReportsStore();

    const appendSpy = jest.spyOn(document.body, "appendChild");
    const removeSpy = jest.spyOn(document.body, "removeChild");

    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = () => "blob:mock";
    }
    const createObjectURLSpy = jest
      .spyOn(window.URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    axios.post.mockResolvedValue({ data: new Blob(["xls"]) });

    await store.generateExcelReport({
      reportType: "processes",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      userId: null,
    });

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });

  test("generateExcelReport sets error and rethrows on failure", async () => {
    const store = useReportsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    axios.post.mockRejectedValue(new Error("boom"));

    await expect(
      store.generateExcelReport({ reportType: "x", startDate: "2026-01-01", endDate: "2026-01-31", userId: null })
    ).rejects.toBeTruthy();

    expect(store.isGenerating).toBe(false);
    expect(store.error).toBe("boom");

    consoleSpy.mockRestore();
  });

  test("generateExcelReport sets default error message when error has no message", async () => {
    const store = useReportsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    axios.post.mockRejectedValue({});

    await expect(
      store.generateExcelReport({
        reportType: "x",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        userId: null,
      })
    ).rejects.toBeTruthy();

    expect(store.isGenerating).toBe(false);
    expect(store.error).toBe("Error al generar el reporte");

    consoleSpy.mockRestore();
  });

  test("generateExcelReport resets isGenerating when axios throws synchronously", async () => {
    const store = useReportsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    axios.post.mockImplementation(() => {
      throw new Error("sync");
    });

    await expect(
      store.generateExcelReport({
        reportType: "x",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        userId: null,
      })
    ).rejects.toBeTruthy();

    expect(store.isGenerating).toBe(false);
    expect(store.error).toBe("sync");

    consoleSpy.mockRestore();
  });
});
