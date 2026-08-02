import { describe, expect, it } from "vitest";
import {
  cacheKey,
  dateSortValue,
  decodeSortValue,
  formatRelativeDate,
  isCacheStale,
  mergeFailedRefresh,
  numericSortValue,
} from "../src/cache-logic";
import type { CacheRecord } from "../src/types";

const record = (count: number | null, overrides: Partial<CacheRecord> = {}): CacheRecord => ({
  libraryID: 1,
  itemKey: "ABC123",
  normalizedDOI: "10.1000/example",
  openAlexWorkID: "W1",
  citationCount: count,
  status: count === null ? "error" : "success",
  lastSuccessfulAt: count === null ? null : 1_000,
  lastAttemptedAt: 1_000,
  errorCode: null,
  schemaVersion: 1,
  ...overrides,
});

describe("cache logic", () => {
  it("preserves a previous valid count after a failed refresh for the same DOI", () => {
    const merged = mergeFailedRefresh(record(23), { libraryID: 1, itemKey: "ABC123" }, "10.1000/example", "network", 2000);
    expect(merged.citationCount).toBe(23);
    expect(merged.lastSuccessfulAt).toBe(1000);
    expect(merged.status).toBe("error");
  });

  it("invalidates the old count when the DOI changes", () => {
    const merged = mergeFailedRefresh(record(23), { libraryID: 1, itemKey: "ABC123" }, "10.2000/new", "doi-changed", 2000);
    expect(merged.citationCount).toBeNull();
    expect(merged.lastSuccessfulAt).toBeNull();
  });

  it("calculates cache staleness and supports never automatically", () => {
    const cached = record(1, { lastSuccessfulAt: 1_000 });
    expect(isCacheStale(cached, 30, 1_000 + 30 * 86_400_000)).toBe(true);
    expect(isCacheStale(cached, 30, 1_000 + 29 * 86_400_000)).toBe(false);
    expect(isCacheStale(cached, 0, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("sorts citation counts numerically rather than lexicographically", () => {
    const values = [record(100), record(9), record(20), record(0)].map(numericSortValue).sort();
    expect(values.map((value) => decodeSortValue(value)?.citationCount)).toEqual([0, 9, 20, 100]);
  });

  it("uses library ID plus stable item key for identity", () => {
    expect(cacheKey({ libraryID: 1, itemKey: "SAME" })).not.toBe(cacheKey({ libraryID: 2, itemKey: "SAME" }));
  });

  it("sorts extraction dates chronologically, with never-fetched records first", () => {
    const values = [
      record(1, { lastSuccessfulAt: 3_000 }),
      record(null, { lastSuccessfulAt: null }),
      record(1, { lastSuccessfulAt: 1_000 }),
      record(1, { lastSuccessfulAt: 2_000 }),
    ]
      .map(dateSortValue)
      .sort();
    expect(values.map((value) => decodeSortValue(value)?.lastSuccessfulAt)).toEqual([null, 1000, 2000, 3000]);
  });

  it("formats the extraction date as a relative age", () => {
    const now = 10 * 86_400_000;
    expect(formatRelativeDate(now, now)).toBe("Today");
    expect(formatRelativeDate(now - 86_400_000, now)).toBe("Yesterday");
    expect(formatRelativeDate(now - 5 * 86_400_000, now)).toBe("5 days ago");
    expect(formatRelativeDate(now - 40 * 86_400_000, now)).toBe("1 month ago");
    expect(formatRelativeDate(now - 400 * 86_400_000, now)).toBe("1 year ago");
  });
});
