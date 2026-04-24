import { statusClass, formatDate } from "@/composables/useServiceRequestHelpers";

describe("useServiceRequestHelpers", () => {
  describe("statusClass", () => {
    test("returns blue classes for OPEN status", () => {
      expect(statusClass("OPEN")).toBe("bg-blue-100 text-blue-800");
    });

    test("returns amber classes for IN_STUDY status", () => {
      expect(statusClass("IN_STUDY")).toBe("bg-amber-100 text-amber-800");
    });

    test("returns indigo classes for IN_PROGRESS status", () => {
      expect(statusClass("IN_PROGRESS")).toBe("bg-indigo-100 text-indigo-800");
    });

    test("returns emerald classes for ANSWERED status", () => {
      expect(statusClass("ANSWERED")).toBe("bg-emerald-100 text-emerald-800");
    });

    test("returns gray classes for FINALIZED status", () => {
      expect(statusClass("FINALIZED")).toBe("bg-gray-100 text-gray-700");
    });

    test("returns fallback gray classes for unknown status", () => {
      expect(statusClass("UNKNOWN")).toBe("bg-gray-100 text-gray-700");
    });
  });

  describe("formatDate", () => {
    test("returns dash for empty string", () => {
      expect(formatDate("")).toBe("-");
    });

    test("returns dash for null", () => {
      expect(formatDate(null)).toBe("-");
    });

    test("returns dash for undefined", () => {
      expect(formatDate(undefined)).toBe("-");
    });

    test("returns formatted date string for valid ISO date", () => {
      const result = formatDate("2026-04-08T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result).not.toBe("-");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
