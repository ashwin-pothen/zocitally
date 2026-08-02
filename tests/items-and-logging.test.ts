import { describe, expect, it } from "vitest";
import { deduplicateItems, isEligibleItem } from "../src/items";
import { redactAPIKey } from "../src/utils/logging";
import type { EligibleItem } from "../src/types";

function item(key: string, type: "regular" | "attachment" | "note" | "annotation" = "regular"): EligibleItem {
  return {
    libraryID: 1,
    key,
    isRegularItem: () => type === "regular",
    isAttachment: () => type === "attachment",
    isNote: () => type === "note",
    isAnnotation: () => type === "annotation",
    getField: () => "",
  };
}

describe("item eligibility", () => {
  it("accepts only regular bibliographic items", () => {
    expect(isEligibleItem(item("A"))).toBe(true);
    expect(isEligibleItem(item("B", "attachment"))).toBe(false);
    expect(isEligibleItem(item("C", "note"))).toBe(false);
    expect(isEligibleItem(item("D", "annotation"))).toBe(false);
  });

  it("deduplicates using library ID and item key", () => {
    const otherLibrary = { ...item("A"), libraryID: 2 };
    expect(deduplicateItems([item("A"), item("A"), otherLibrary, item("B", "note")])).toHaveLength(2);
  });
});

describe("API-key redaction", () => {
  it("redacts query parameters and direct key occurrences", () => {
    const key = "oa-secret-123";
    const redacted = redactAPIKey(`GET https://api.openalex.org/rate-limit?api_key=${key} failed: ${key}`, key);
    expect(redacted).not.toContain(key);
    expect(redacted).toContain("[REDACTED]");
  });
});
