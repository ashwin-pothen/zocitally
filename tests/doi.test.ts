import { describe, expect, it } from "vitest";
import { isValidDOI, normalizeDOI } from "../src/utils/doi";

describe("DOI normalization", () => {
  it.each([
    ["  doi: 10.1000/ABC.123  ", "10.1000/abc.123"],
    ["https://doi.org/10.5555/Hello_(World).", "10.5555/hello_(world)"],
    ["http://doi.org/10.1234/ABC", "10.1234/abc"],
    ["https://dx.doi.org/10.12345/a-b_c;d", "10.12345/a-b_c;d"],
    ["<10.1000/example>", "10.1000/example"],
    ["10.1000/example).", "10.1000/example"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDOI(input)).toBe(expected);
  });

  it.each(["", "example", "11.1000/foo", "10.12/foo", "10.1234/has spaces"])(
    "rejects invalid value %s",
    (input) => expect(normalizeDOI(input)).toBeNull(),
  );

  it("validates conservatively", () => {
    expect(isValidDOI("10.1234/abc:def(ghi)")).toBe(true);
    expect(isValidDOI("10.1234/")).toBe(false);
  });
});
