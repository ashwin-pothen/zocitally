import { SCHEMA_VERSION, type CacheIdentity, type CacheRecord } from "./types";

export function cacheKey(identity: CacheIdentity): string {
  return `${identity.libraryID}:${identity.itemKey}`;
}

export function isCacheStale(record: CacheRecord, intervalDays: number, now = Date.now()): boolean {
  if (intervalDays === 0 || record.lastSuccessfulAt === null) return false;
  return now - record.lastSuccessfulAt >= intervalDays * 86_400_000;
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
