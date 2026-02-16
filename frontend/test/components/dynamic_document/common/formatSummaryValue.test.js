import { formatSummaryValue } from "@/components/dynamic_document/common/formatSummaryValue";

describe("formatSummaryValue", () => {
  test("returns empty string when summary_value is null", () => {
    const result = formatSummaryValue({ summary_value: null });
    expect(result).toBe("");
  });

  test("returns empty string when summary_value is undefined", () => {
    const result = formatSummaryValue({ summary_value: undefined });
    expect(result).toBe("");
  });

  test("returns empty string when summary_value is empty string", () => {
    const result = formatSummaryValue({ summary_value: "" });
    expect(result).toBe("");
  });

  test("returns raw value when summary_value cannot be parsed as a number (NaN fallback, line 21)", () => {
    // After regex pipeline: "1,,2" → "1,,2" → "1,,2" → "1.,2" → Number("1.,2") = NaN
    const result = formatSummaryValue({ summary_value: "1,,2" });
    expect(result).toBe("1,,2");
  });

  test("returns formatted number without currency prefix when summary_value_currency is missing (line 42)", () => {
    const result = formatSummaryValue({ summary_value: "1000" });
    // No currency → just the locale-formatted number
    expect(result).not.toBe("");
    expect(result).not.toContain("$");
    expect(result).not.toContain("€");
  });

  test("returns formatted number without currency prefix when summary_value_currency is empty string", () => {
    const result = formatSummaryValue({
      summary_value: "1000",
      summary_value_currency: "",
    });
    expect(result).not.toBe("");
    expect(result).not.toContain("$");
    expect(result).not.toContain("€");
  });

  test("formats COP currency correctly", () => {
    const result = formatSummaryValue({
      summary_value: "1234567",
      summary_value_currency: "COP",
    });
    expect(result).toContain("COP $");
  });

  test("formats USD currency correctly", () => {
    const result = formatSummaryValue({
      summary_value: "500",
      summary_value_currency: "USD",
    });
    expect(result).toContain("USD $");
  });

  test("formats EUR currency correctly", () => {
    const result = formatSummaryValue({
      summary_value: "500",
      summary_value_currency: "EUR",
    });
    expect(result).toContain("EUR €");
  });

  test("uses raw currency code as label when not in the known map", () => {
    const result = formatSummaryValue({
      summary_value: "500",
      summary_value_currency: "GBP",
    });
    expect(result).toContain("GBP");
  });
});
