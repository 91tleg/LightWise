import {
  safeNum,
  roundValue,
  formatDateTimeLocal,
  formatTimestamp,
  formatTableTimestamp,
} from "./formatters";

describe("formatters", () => {
  describe("safeNum", () => {
    test("returns number for valid numeric input", () => {
      expect(safeNum("42")).toBe(42);
      expect(safeNum(3.14)).toBe(3.14);
      expect(safeNum("3.5")).toBe(3.5);
    });

    test("returns null for invalid input", () => {
      expect(safeNum("abc")).toBeNull();
      expect(safeNum(undefined)).toBeNull();
      expect(safeNum(null)).toBe(0);
      expect(safeNum(NaN)).toBeNull();
    });
  });

  describe("roundValue", () => {
    test("rounds to 0 digits by default", () => {
      expect(roundValue(12.6)).toBe(13);
      expect(roundValue(12.4)).toBe(12);
    });

    test("rounds to requested digits", () => {
      expect(roundValue(12.345, 2)).toBe(12.35);
      expect(roundValue(9.94, 1)).toBe(9.9);
      expect(roundValue(9.95, 1)).toBe(10);
    });

    test("returns null for invalid input", () => {
      expect(roundValue("abc")).toBeNull();
    });
  });

  describe("formatDateTimeLocal", () => {
    test("formats a date to yyyy-mm-ddThh:mm", () => {
      const date = new Date(2026, 2, 9, 14, 7);
      expect(formatDateTimeLocal(date)).toBe("2026-03-09T14:07");
    });

    test("returns empty string for invalid date", () => {
      expect(formatDateTimeLocal("bad-date")).toBe("");
    });
  });

  describe("formatTimestamp", () => {
    test("returns fallback when timestamp is missing", () => {
      expect(formatTimestamp(null)).toBe("Waiting for data");
      expect(formatTimestamp(undefined)).toBe("Waiting for data");
    });

    test("returns raw string when timestamp is invalid", () => {
      expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    });

    test("formats a valid timestamp", () => {
      const result = formatTimestamp("2026-03-09T21:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatTableTimestamp", () => {
    test("returns fallback when timestamp is missing", () => {
      expect(formatTableTimestamp(null)).toBe("--");
      expect(formatTableTimestamp(undefined)).toBe("--");
    });

    test("returns raw string when timestamp is invalid", () => {
      expect(formatTableTimestamp("bad-value")).toBe("bad-value");
    });

    test("formats a valid timestamp", () => {
      const result = formatTableTimestamp("2026-03-09T21:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});