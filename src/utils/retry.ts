import type { RetryOptions } from "../types";

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export function parseRetryAfter(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

export function retryDelay(attempt: number, retryAfterMs: number | null, options: RetryOptions): number {
  if (retryAfterMs !== null) return Math.min(retryAfterMs, options.maxDelayMs);
  return Math.min(options.baseDelayMs * 2 ** attempt, options.maxDelayMs);
}
