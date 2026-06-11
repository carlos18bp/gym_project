import {
  replaceVariablesWithProtectedSpans,
  countProtectedVariableSpans,
} from "@/shared/document_utils";

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: jest.fn(),
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => ({ lastUpdatedDocumentId: null }),
}));

jest.mock("@/composables/useRecentViews", () => ({
  __esModule: true,
  useRecentViews: () => ({
    registerView: jest.fn(),
  }),
}));

describe("document_utils.replaceVariablesWithProtectedSpans", () => {
  test("returns content unchanged when content is empty", () => {
    expect(replaceVariablesWithProtectedSpans("", [])).toBe("");
  });

  test("replaces a known variable with a protected span showing its value", () => {
    const result = replaceVariablesWithProtectedSpans(
      "<p>Contrato {{Numero_contrato}}</p>",
      [{ name_en: "Numero_contrato", name_es: "Número de contrato", value: "001-2026" }]
    );

    expect(result).toContain('data-variable="Numero_contrato"');
    expect(result).toContain(">001-2026</span>");
  });

  test("shows bracketed spanish name when a known variable has no value", () => {
    const result = replaceVariablesWithProtectedSpans(
      "<p>{{Numero_contrato}}</p>",
      [{ name_en: "Numero_contrato", name_es: "Número de contrato", value: "" }]
    );

    expect(result).toContain(">[Número de contrato]</span>");
  });

  test("protects an orphan token with no matching variable", () => {
    const result = replaceVariablesWithProtectedSpans(
      "<p>Contrato {{Numero_ contrato}}</p>",
      [{ name_en: "Numero_contrato", name_es: "Número", value: "001" }]
    );

    expect(result).not.toContain("{{");
    expect(result).toContain('data-variable="Numero_ contrato"');
  });

  test("shows an orphan token as its bracketed name", () => {
    const result = replaceVariablesWithProtectedSpans("<p>{{Token_viejo}}</p>", []);

    expect(result).toContain(">[Token_viejo]</span>");
  });

  test("protects a fragmented variable split across inline tags", () => {
    const result = replaceVariablesWithProtectedSpans(
      "<p>{{<span>Numero_contrato</span>}}</p>",
      [{ name_en: "Numero_contrato", name_es: "Número", value: "001" }]
    );

    expect(result).toContain(">001</span>");
  });
});

describe("document_utils.countProtectedVariableSpans", () => {
  test("returns zero for null content", () => {
    expect(countProtectedVariableSpans(null)).toBe(0);
  });

  test("counts one span per protected variable", () => {
    const content = replaceVariablesWithProtectedSpans(
      "<p>{{a}} y {{b}} y {{huerfana}}</p>",
      [
        { name_en: "a", name_es: "A", value: "1" },
        { name_en: "b", name_es: "B", value: "2" },
      ]
    );

    expect(countProtectedVariableSpans(content)).toBe(3);
  });
});
