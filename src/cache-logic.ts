import { SCHEMA_VERSION, type CacheIdentity, type CacheRecord } from "./types";

export function cacheKey(identity: CacheIdentity): string {
  return `${identity.libraryID}:${identity.itemKey}`;
}

export function mergeFailedRefresh(
  previous: CacheRecord | undefined,
  identity: CacheIdentity,
  normalizedDOI: string | null,
  errorCode: string,
  now: number,
): CacheRecord {
  const sameDOI = previous?.normalizedDOI === normalizedDOI;
  return {
    ...identity,
    normalizedDOI,
    openAlexWorkID: sameDOI ? previous.openAlexWorkID : null,
    citationCount: sameDOI ? previous.citationCount : null,
    status: "error",
    lastSuccessfulAt: sameDOI ? previous.lastSuccessfulAt : null,
    lastAttemptedAt: now,
    errorCode,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function numericSortValue(record: CacheRecord | undefined): string {
  if (!record) return "";
  if (record.citationCount !== null) {
    return `1|${String(record.citationCount).padStart(16, "0")}|${JSON.stringify(record)}`;
  }
  const rank = record.status === "missing-doi" ? "2" : record.status === "not-found" ? "3" : "4";
  return `${rank}|${JSON.stringify(record)}`;
}

export function decodeSortValue(value: string): CacheRecord | null {
  if (!value) return null;
  const jsonStart = value.indexOf("{");
  if (jsonStart < 0) return null;
  try {
    return JSON.parse(value.slice(jsonStart)) as CacheRecord;
  } catch {
    return null;
  }
}

export function dateSortValue(record: CacheRecord | undefined): string {
  if (!record) return "";
  const timestamp = record.lastSuccessfulAt ?? 0;
  return `${String(timestamp).padStart(19, "0")}|${JSON.stringify(record)}`;
}

export function formatRelativeDate(timestamp: number, now = Date.now()): string {
  const diffDays = Math.floor(Math.max(0, now - timestamp) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}
