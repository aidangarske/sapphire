import { describe, expect, it } from "vitest";
import { parseGoogleDate } from "./calendar";

describe("parseGoogleDate", () => {
  it("parses an all-day date as local midnight, not UTC", () => {
    const got = parseGoogleDate("2026-06-17", true);
    expect(got).toBe(new Date(2026, 5, 17).getTime());
  });

  it("keeps the calendar day west of UTC", () => {
    expect(new Date(parseGoogleDate("2026-06-17", true)).getDate()).toBe(17);
  });

  it("parses a timed dateTime as an absolute instant", () => {
    const iso = "2026-06-17T09:30:00-07:00";
    expect(parseGoogleDate(iso, false)).toBe(new Date(iso).getTime());
  });

  it("does not apply local-date handling when allDay is false", () => {
    const iso = "2026-06-17T00:00:00Z";
    expect(parseGoogleDate(iso, false)).toBe(new Date(iso).getTime());
  });
});
