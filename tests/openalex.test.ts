import { describe, expect, it, vi } from "vitest";
import { OpenAlexClient, OpenAlexError, parseCitationResponse } from "../src/openalex";
import type { HttpResponse } from "../src/types";

const response = (status: number, body = "", headers: Record<string, string> = {}): HttpResponse => ({
  status,
  body,
  headers,
});

describe("OpenAlex response handling", () => {
  it("parses cited_by_count and preserves a valid zero", () => {
    expect(parseCitationResponse({ id: "https://openalex.org/W1", doi: null, cited_by_count: 0 })).toEqual({
      kind: "success",
      count: 0,
      openAlexWorkID: "https://openalex.org/W1",
      doi: null,
    });
  });

  it.each([
    { id: "W1" },
    { id: "W1", cited_by_count: null },
    { id: "W1", cited_by_count: -1 },
    { id: "W1", cited_by_count: 1.5 },
  ])("rejects a missing or malformed count", (body) => {
    expect(() => parseCitationResponse(body)).toThrow(OpenAlexError);
  });

  it("handles 404 distinctly", async () => {
    const client = new OpenAlexClient({ transport: async () => response(404) });
    await expect(client.getCitationCount("10.1000/example")).resolves.toEqual({ kind: "not-found" });
  });

  it.each([401, 403])("handles authentication status %i", async (status) => {
    const client = new OpenAlexClient({ transport: async () => response(status) });
    await expect(client.getCitationCount("10.1000/example")).rejects.toMatchObject({ code: "authentication", status });
  });

  it("honors Retry-After for 429 and then succeeds", async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(response(429, "", { "retry-after": "2" }))
      .mockResolvedValueOnce(response(200, JSON.stringify({ id: "W1", cited_by_count: 4 })));
    const sleep = vi.fn(async () => undefined);
    const client = new OpenAlexClient({ transport, retry: { sleep, maxRetries: 2 } });
    await expect(client.getCitationCount("10.1000/example")).resolves.toMatchObject({ count: 4 });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("stops retrying transient server errors at the configured limit", async () => {
    const transport = vi.fn(async () => response(503));
    const sleep = vi.fn(async () => undefined);
    const client = new OpenAlexClient({ transport, retry: { sleep, maxRetries: 2, baseDelayMs: 1 } });
    await expect(client.getCitationCount("10.1000/example")).rejects.toMatchObject({ code: "server-error" });
    expect(transport).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("uses selected fields and keeps an API key out of path components", async () => {
    const transport = vi.fn(async (_url: string) => response(404));
    const client = new OpenAlexClient({ apiKey: "secret-key", transport });
    await client.getCitationCount("10.1000/example");
    const url = String(transport.mock.calls[0]?.[0]);
    expect(url).toContain("select=id%2Cdoi%2Ccited_by_count");
    expect(url).toContain("api_key=secret-key");
    expect(url).toContain("doi%3A10.1000%2Fexample");
  });
});
