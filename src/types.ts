export const PLUGIN_ID = "zocitally@ashwin-pothen";
export const PLUGIN_NAME = "Zocitally";
export const PLUGIN_VERSION = "0.2.0";
export const PREF_BRANCH = "extensions.zocitally.";
export const LEGACY_PREF_BRANCHES = ["extensions.citesight.", "extensions.openalex-citations."] as const;
export const SCHEMA_VERSION = 1;
// Retained so Zocitally opens the existing cache in place instead of discarding citation data.
export const DATABASE_NAME = "openalex-citation-count";

export type CacheStatus = "success" | "missing-doi" | "not-found" | "error";

export interface CacheIdentity {
  libraryID: number;
  itemKey: string;
}

export interface CacheRecord extends CacheIdentity {
  normalizedDOI: string | null;
  openAlexWorkID: string | null;
  citationCount: number | null;
  status: CacheStatus;
  lastSuccessfulAt: number | null;
  lastAttemptedAt: number;
  errorCode: string | null;
  schemaVersion: number;
}

export interface CitationResult {
  kind: "success";
  count: number;
  openAlexWorkID: string;
  doi: string | null;
}

export interface NotFoundResult {
  kind: "not-found";
}

export type OpenAlexResult = CitationResult | NotFoundResult;

export interface HttpResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export type HttpTransport = (url: string) => Promise<HttpResponse>;

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep: (milliseconds: number) => Promise<void>;
}

export interface EligibleItem {
  libraryID: number;
  key: string;
  isRegularItem(): boolean;
  isAttachment(): boolean;
  isNote(): boolean;
  isAnnotation(): boolean;
  getField(field: string): string;
  parentItemID?: number | false;
}

export interface UpdateSummary {
  completed: number;
  total: number;
  success: number;
  missingDOI: number;
  notFound: number;
  failures: number;
  cancelled: boolean;
  authenticationError: boolean;
}

export interface CancellationToken {
  cancelled: boolean;
  cancel(): void;
}

export interface PluginPublicAPI {
  testAPIConnection(): Promise<string>;
  clearCacheFromPreferences(): Promise<string>;
  openSettings(): void;
}

export interface BootstrapData {
  id: string;
  version: string;
  rootURI: string;
}
