import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateKey,
  formatTime,
  isValidDateKey,
  isValidTime,
  parseDateKey,
  parseTime,
  todayKey,
} from "@/lib/utils";

describe("date utils", () => {
  it("parses and formats YYYY-MM-DD dates", () => {
    const date = parseDateKey("2026-08-06");
    expect(formatDateKey(date)).toBe("2026-08-06");
    expect(isValidDateKey("2026-08-06")).toBe(true);
    expect(isValidDateKey("2026-13-01")).toBe(false);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("parses and formats HH:mm times", () => {
    expect(formatTime(parseTime("09:30"))).toBe("09:30");
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("25:00")).toBe(false);
  });

  it("returns today key in YYYY-MM-DD format", () => {
    expect(todayKey("Asia/Shanghai")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
