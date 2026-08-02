import type { HttpResponse, HttpTransport, OpenAlexResult, RetryOptions } from "./types";
import { DEFAULT_RETRY_OPTIONS, parseRetryAfter, retryDelay } from "./utils/retry";

const API_BASE = "https://api.openalex.org";

export class OpenAlexError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "OpenAlexError";
  }
}

export interface OpenAlexClientOptions {
  apiKey?: string;
  transport: HttpTransport;
  retry?: Partial<RetryOptions>;
}

export class OpenAlexClient {
  private readonly retry: RetryOptions;

  constructor(private readonly options: OpenAlexClientOptions) {
    this.retry = { ...DEFAULT_RETRY_OPTIONS, ...options.retry };
  }

  async getCitationCount(normalizedDOI: string): Promise<OpenAlexResult> {
    const identifier = `doi:${normalizedDOI}`;
    const url = this.url(`/works/${encodeURIComponent(identifier)}`, {
      select: "id,doi,cited_by_count",
    });
    const response = await this.requestWithRetry(url);

    if (response.status === 404) return { kind: "not-found" };
    this.throwForStatus(response.status);

    let data: unknown;
    try {
      data = JSON.parse(response.body);
    } catch {
      throw new OpenAlexError("OpenAlex returned invalid JSON.", "malformed-response", response.status);
    }
    return parseCitationResponse(data);
  }

  async testConnection(): Promise<void> {
    if (!this.options.apiKey?.trim()) {
      throw new OpenAlexError(
        "Enter an OpenAlex API key before testing authentication. DOI lookups can still run without one.",
        "missing-api-key",
      );
    }
    const response = await this.requestWithRetry(this.url("/rate-limit"));
    this.throwForStatus(response.status);
    try {
      const value = JSON.parse(response.body) as { rate_limit?: unknown };
      if (!value || typeof value !== "object" || !("rate_limit" in value)) throw new Error("missing rate_limit");
    } catch {
      throw new OpenAlexError("OpenAlex returned an unexpected connection-test response.", "malformed-response");
    }
  }

  private async requestWithRetry(url: string): Promise<HttpResponse> {
    let attempt = 0;
    while (true) {
      let response: HttpResponse;
      try {
        response = await this.options.transport(url);
      } catch (error) {
        if (attempt >= this.retry.maxRetries) {
          throw new OpenAlexError(
            `Network request failed: ${error instanceof Error ? error.message : "unknown network error"}`,
            "network-error",
          );
        }
        await this.retry.sleep(retryDelay(attempt, null, this.retry));
        attempt += 1;
        continue;
      }

      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt >= this.retry.maxRetries) return response;
      const retryAfter = parseRetryAfter(response.headers["retry-after"]);
      await this.retry.sleep(retryDelay(attempt, retryAfter, this.retry));
      attempt += 1;
    }
  }

  private throwForStatus(status: number): void {
    if (status >= 200 && status < 300) return;
    if (status === 401 || status === 403) {
      throw new OpenAlexError("OpenAlex rejected the API key. Check it in plugin settings.", "authentication", status);
    }
    if (status === 429) {
      throw new OpenAlexError("OpenAlex rate limit exceeded after retrying.", "rate-limit", status);
    }
    if (status >= 500) {
      throw new OpenAlexError("OpenAlex is temporarily unavailable after retrying.", "server-error", status);
    }
    throw new OpenAlexError(`OpenAlex request failed with HTTP ${status}.`, `http-${status}`, status);
  }

  private url(path: string, params: Record<string, string> = {}): string {
    const query = new URLSearchParams(params);
    const key = this.options.apiKey?.trim();
    if (key) query.set("api_key", key);
    const suffix = query.toString();
    return `${API_BASE}${path}${suffix ? `?${suffix}` : ""}`;
  }
}

export function parseCitationResponse(value: unknown): OpenAlexResult {
  if (!value || typeof value !== "object") {
    throw new OpenAlexError("OpenAlex response was not an object.", "malformed-response");
  }
  const object = value as Record<string, unknown>;
  if (typeof object.id !== "string" || object.id.length === 0) {
    throw new OpenAlexError("OpenAlex response did not contain a work ID.", "malformed-response");
  }
  if (!Number.isInteger(object.cited_by_count) || Number(object.cited_by_count) < 0) {
    throw new OpenAlexError("OpenAlex response did not contain a valid cited_by_count.", "malformed-response");
  }
  const doi = typeof object.doi === "string" ? object.doi : null;
  return {
    kind: "success",
    count: Number(object.cited_by_count),
    openAlexWorkID: object.id,
    doi,
  };
}
