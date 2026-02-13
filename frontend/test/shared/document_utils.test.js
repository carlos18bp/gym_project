import {
  getProcessedDocumentContent,
  openPreviewModal,
  previewDocument,
  downloadFile,
  showPreviewModal,
  previewDocumentData,
} from "@/shared/document_utils";

import { get_request } from "@/stores/services/request_http";

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: jest.fn(),
}));

const mockDynamicDocumentStore = {
  lastUpdatedDocumentId: null,
};

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDynamicDocumentStore,
}));

jest.mock("@/composables/useRecentViews", () => ({
  __esModule: true,
  useRecentViews: () => ({
    registerView: jest.fn(),
  }),
}));

describe("document_utils.getProcessedDocumentContent", () => {
  test("returns empty string when document is null", () => {
    expect(getProcessedDocumentContent(null)).toBe("");
  });

  test("returns empty string when document content is missing", () => {
    expect(
      getProcessedDocumentContent({
        state: "Completed",
        variables: [{ name_en: "name", value: "Carlos" }],
      })
    ).toBe("");
  });

  test("replaces missing variable values with empty string", () => {
    const doc = {
      state: "Completed",
      content: "Hello {{ name }}",
      variables: [{ name_en: "name" }],
    };

    expect(getProcessedDocumentContent(doc)).toBe("Hello ");
  });

  test("formats value without currency label when currency is missing", () => {
    const doc = {
      state: "Completed",
      content: "Value: {{ amount }}",
      variables: [
        {
          name_en: "amount",
          value: "12345",
          summary_field: "value",
        },
      ],
    };

    const out = getProcessedDocumentContent(doc);
    expect(out).toContain("12.345");
    expect(out).toBe("Value: 12.345");
  });

  test("keeps raw content when state is not processed", () => {
    const doc = {
      state: "Draft",
      content: "Hola {{ name }}",
      variables: [{ name_en: "name", value: "Carlos" }],
    };

    expect(getProcessedDocumentContent(doc)).toBe("Hola {{ name }}");
  });

  test("formats value with currency label when summary_field is value", () => {
    const doc = {
      state: "Completed",
      content: "Monto: {{ amount }}",
      variables: [
        {
          name_en: "amount",
          value: "1234,5",
          summary_field: "value",
          currency: "USD",
        },
      ],
    };

    const formatted = (1234.5).toLocaleString("es-CO", {
      maximumFractionDigits: 2,
    });

    expect(getProcessedDocumentContent(doc)).toBe(`Monto: US $ ${formatted}`);
  });

  test("keeps original value when numeric normalization results in NaN", () => {
    const doc = {
      state: "Completed",
      content: "Monto: {{ amount }}",
      variables: [
        {
          name_en: "amount",
          value: "1,2,3",
          summary_field: "value",
          currency: "USD",
        },
      ],
    };

    expect(getProcessedDocumentContent(doc)).toBe("Monto: 1,2,3");
  });
});

describe("document_utils.openPreviewModal", () => {
  beforeEach(() => {
    localStorage.clear();
    mockDynamicDocumentStore.lastUpdatedDocumentId = null;
    showPreviewModal.value = false;
    previewDocumentData.value = { title: "", content: "" };
  });

  test("sets previewDocumentData and showPreviewModal and stores lastUpdatedDocumentId", () => {
    openPreviewModal({
      id: 10,
      title: "Doc",
      state: "Draft",
      content: "Hi",
      variables: [],
    });

    expect(previewDocumentData.value).toEqual({
      title: "Doc",
      content: "Hi",
    });
    expect(showPreviewModal.value).toBe(true);
    expect(mockDynamicDocumentStore.lastUpdatedDocumentId).toBe(10);
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("10");
  });

  test("does not set lastUpdatedDocumentId when document has no id", () => {
    openPreviewModal({
      title: "Doc",
      state: "Draft",
      content: "Hi",
      variables: [],
    });

    expect(showPreviewModal.value).toBe(true);
    expect(mockDynamicDocumentStore.lastUpdatedDocumentId).toBe(null);
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe(null);
  });

  test("uses empty title when document title is missing", () => {
    openPreviewModal({
      id: 11,
      state: "Draft",
      content: "Hi",
      variables: [],
    });

    expect(previewDocumentData.value.title).toBe("");
  });
});

describe("document_utils.previewDocument", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("sets lastUpdatedDocumentId and navigates to preview URL", async () => {
    const store = { lastUpdatedDocumentId: null };

    const originalLocation = window.location;
    delete window.location;
    window.location = { href: "" };

    await previewDocument({ id: 77 }, store);

    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("77");
    expect(store.lastUpdatedDocumentId).toBe(77);
    expect(window.location.href).toBe("/dynamic_document/preview/77");

    window.location = originalLocation;
  });

  test("logs error when previewDocument fails", async () => {
    const store = { lastUpdatedDocumentId: null };
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("fail");
      });

    const originalLocation = window.location;
    delete window.location;
    window.location = { href: "start" };

    await previewDocument({ id: 77 }, store);

    expect(consoleSpy).toHaveBeenCalled();
    expect(window.location.href).toBe("start");

    window.location = originalLocation;
    setItemSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("document_utils.downloadFile", () => {
  const mockCreateObjectURL = jest.fn(() => "blob:mock");
  const mockRevokeObjectURL = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = "";

    Object.defineProperty(window, "URL", {
      value: {
        createObjectURL: (...args) => mockCreateObjectURL(...args),
        revokeObjectURL: (...args) => mockRevokeObjectURL(...args),
      },
      configurable: true,
    });

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("downloads and cleans up link + object URL", async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    get_request.mockResolvedValueOnce({
      data: new Blob([new Uint8Array(1500)]),
    });

    await downloadFile("/file", "a.pdf");

    expect(get_request).toHaveBeenCalledWith("/file", "blob");
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(document.querySelector('a[download]')).toBe(null);

    clickSpy.mockRestore();
  });

  test("downloads when small blob has no error text", async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const blob = new Blob(["ok"], { type: "text/plain" });
    if (typeof blob.text !== "function") {
      blob.text = () => Promise.resolve("ok");
    }

    get_request.mockResolvedValueOnce({
      data: blob,
    });

    await downloadFile("/file", "a.pdf", "text/plain");

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock");

    clickSpy.mockRestore();
  });

  test("throws when response has no data", async () => {
    get_request.mockResolvedValueOnce({});

    await expect(downloadFile("/file", "a.pdf")).rejects.toBeTruthy();
    expect(console.error).toHaveBeenCalled();
  });

  test("throws when server returns error text in small blob", async () => {
    const blob = new Blob(["error: fail"], { type: "text/plain" });
    if (typeof blob.text !== "function") {
      blob.text = () => Promise.resolve("error: fail");
    }

    get_request.mockResolvedValueOnce({
      data: blob,
    });

    await expect(downloadFile("/file", "a.pdf")).rejects.toThrow(
      "[ERROR] Server returned error: error: fail"
    );
    expect(console.error).toHaveBeenCalled();
  });

  test("throws when server returns uppercase Error text in small blob", async () => {
    const blob = new Blob(["Error: fail"], { type: "text/plain" });
    if (typeof blob.text !== "function") {
      blob.text = () => Promise.resolve("Error: fail");
    }

    get_request.mockResolvedValueOnce({
      data: blob,
    });

    await expect(downloadFile("/file", "a.pdf")).rejects.toThrow(
      "[ERROR] Server returned error: Error: fail"
    );
    expect(console.error).toHaveBeenCalled();
  });
});

describe("document_utils.getProcessedDocumentContent (additional)", () => {
  test("replaces variables only for Completed/PendingSignatures/FullySigned", () => {
    const doc = {
      state: "Draft",
      content: "Hello {{ name }}",
      variables: [{ name_en: "name", value: "Carlos" }],
    };

    // Draft: no replacement
    expect(getProcessedDocumentContent(doc)).toBe("Hello {{ name }}");

    // Completed: replacement
    expect(getProcessedDocumentContent({ ...doc, state: "Completed" })).toBe("Hello Carlos");
    expect(getProcessedDocumentContent({ ...doc, state: "PendingSignatures" })).toBe("Hello Carlos");
    expect(getProcessedDocumentContent({ ...doc, state: "FullySigned" })).toBe("Hello Carlos");
  });

  test("formats summary_field=value with COP currency", () => {
    const doc = {
      state: "Completed",
      content: "Valor: {{ amount }}",
      variables: [
        {
          name_en: "amount",
          value: "1000000",
          summary_field: "value",
          currency: "COP",
        },
      ],
    };

    const out = getProcessedDocumentContent(doc);
    expect(out).toContain("COP $");
    expect(out).toContain("1.000.000");
  });

  test("normalizes numeric strings and formats with USD/EUR currency", () => {
    const docUsd = {
      state: "Completed",
      content: "USD: {{ amount }}",
      variables: [
        {
          name_en: "amount",
          value: "1.234.567,89",
          summary_field: "value",
          currency: "USD",
        },
      ],
    };

    const outUsd = getProcessedDocumentContent(docUsd);
    expect(outUsd).toContain("US $");
    expect(outUsd).toContain("1.234.567");

    const docEur = {
      state: "Completed",
      content: "EUR: {{ amount }}",
      variables: [
        {
          name_en: "amount",
          value: "1234567,89",
          summary_field: "value",
          currency: "EUR",
        },
      ],
    };

    const outEur = getProcessedDocumentContent(docEur);
    expect(outEur).toContain("EUR €");
    expect(outEur).toContain("1.234.567");
  });

  test("skips replacement when variable is missing name_en", () => {
    const doc = {
      state: "Completed",
      content: "Hello {{ name }}",
      variables: [{ value: "Carlos" }],
    };

    expect(getProcessedDocumentContent(doc)).toBe("Hello {{ name }}");
  });
});
