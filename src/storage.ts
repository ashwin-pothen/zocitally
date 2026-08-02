import {
  DATABASE_NAME,
  SCHEMA_VERSION,
  type CacheIdentity,
  type CacheRecord,
  type CacheStatus,
} from "./types";
import { cacheKey, mergeFailedRefresh } from "./cache-logic";

interface DatabaseRow {
  library_id: number;
  item_key: string;
  normalized_doi: string | null;
  openalex_work_id: string | null;
  citation_count: number | null;
  status: CacheStatus;
  last_success_at: number | null;
  last_attempt_at: number;
  error_code: string | null;
  schema_version: number;
}

export interface DatabaseConnection {
  queryAsync(sql: string, params?: unknown[]): Promise<unknown>;
  valueQueryAsync(sql: string, params?: unknown[]): Promise<unknown>;
  closeDatabase(permanent?: boolean): Promise<void>;
}

export type DatabaseFactory = (name: string) => DatabaseConnection;

export class CitationStorage {
  private database: DatabaseConnection | null = null;
  private readonly records = new Map<string, CacheRecord>();

  constructor(private readonly factory: DatabaseFactory) {}

  async initialize(): Promise<void> {
    this.database = this.factory(DATABASE_NAME);
    await this.db.queryAsync(`CREATE TABLE IF NOT EXISTS openalex_schema (
      version INTEGER NOT NULL
    )`);
    const version = Number(await this.db.valueQueryAsync("SELECT version FROM openalex_schema LIMIT 1") || 0);
    if (version > SCHEMA_VERSION) throw new Error(`Unsupported cache schema version ${version}`);

    await this.db.queryAsync(`CREATE TABLE IF NOT EXISTS openalex_citation_cache (
      library_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      normalized_doi TEXT,
      openalex_work_id TEXT,
      citation_count INTEGER,
      status TEXT NOT NULL CHECK (status IN ('success','missing-doi','not-found','error')),
      last_success_at INTEGER,
      last_attempt_at INTEGER NOT NULL,
      error_code TEXT,
      schema_version INTEGER NOT NULL,
      PRIMARY KEY (library_id, item_key)
    )`);
    await this.db.queryAsync(
      "CREATE INDEX IF NOT EXISTS openalex_cache_doi_idx ON openalex_citation_cache(normalized_doi)",
    );
    if (version === 0) {
      await this.db.queryAsync("DELETE FROM openalex_schema");
      await this.db.queryAsync("INSERT INTO openalex_schema(version) VALUES (?)", [SCHEMA_VERSION]);
    }
    await this.loadIntoMemory();
  }

  getSync(identity: CacheIdentity): CacheRecord | undefined {
    return this.records.get(cacheKey(identity));
  }

  async saveSuccess(
    identity: CacheIdentity,
    normalizedDOI: string,
    openAlexWorkID: string,
    citationCount: number,
    now = Date.now(),
  ): Promise<CacheRecord> {
    const record: CacheRecord = {
      ...identity,
      normalizedDOI,
      openAlexWorkID,
      citationCount,
      status: "success",
      lastSuccessfulAt: now,
      lastAttemptedAt: now,
      errorCode: null,
      schemaVersion: SCHEMA_VERSION,
    };
    await this.upsert(record);
    return record;
  }

  async saveTerminalStatus(
    identity: CacheIdentity,
    normalizedDOI: string | null,
    status: "missing-doi" | "not-found",
    now = Date.now(),
  ): Promise<CacheRecord> {
    const record: CacheRecord = {
      ...identity,
      normalizedDOI,
      openAlexWorkID: null,
      citationCount: null,
      status,
      lastSuccessfulAt: null,
      lastAttemptedAt: now,
      errorCode: null,
      schemaVersion: SCHEMA_VERSION,
    };
    await this.upsert(record);
    return record;
  }

  async saveError(
    identity: CacheIdentity,
    normalizedDOI: string | null,
    errorCode: string,
    now = Date.now(),
  ): Promise<CacheRecord> {
    const record = mergeFailedRefresh(this.getSync(identity), identity, normalizedDOI, errorCode, now);
    await this.upsert(record);
    return record;
  }

  async count(): Promise<number> {
    return Number(await this.db.valueQueryAsync("SELECT COUNT(*) FROM openalex_citation_cache") || 0);
  }

  async clear(): Promise<number> {
    const count = await this.count();
    await this.db.queryAsync("DELETE FROM openalex_citation_cache");
    this.records.clear();
    return count;
  }

  async close(): Promise<void> {
    if (!this.database) return;
    await this.database.closeDatabase(true);
    this.database = null;
    this.records.clear();
  }

  private get db(): DatabaseConnection {
    if (!this.database) throw new Error("Citation storage is not initialized");
    return this.database;
  }

  private async loadIntoMemory(): Promise<void> {
    this.records.clear();
    const result = await this.db.queryAsync("SELECT * FROM openalex_citation_cache");
    const rows = result as DatabaseRow[];
    for (const row of rows) {
      const record = fromRow(row);
      this.records.set(cacheKey(record), record);
    }
  }

  private async upsert(record: CacheRecord): Promise<void> {
    await this.db.queryAsync(
      `INSERT INTO openalex_citation_cache (
        library_id, item_key, normalized_doi, openalex_work_id, citation_count, status,
        last_success_at, last_attempt_at, error_code, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(library_id, item_key) DO UPDATE SET
        normalized_doi=excluded.normalized_doi,
        openalex_work_id=excluded.openalex_work_id,
        citation_count=excluded.citation_count,
        status=excluded.status,
        last_success_at=excluded.last_success_at,
        last_attempt_at=excluded.last_attempt_at,
        error_code=excluded.error_code,
        schema_version=excluded.schema_version`,
      [
        record.libraryID,
        record.itemKey,
        record.normalizedDOI,
        record.openAlexWorkID,
        record.citationCount,
        record.status,
        record.lastSuccessfulAt,
        record.lastAttemptedAt,
        record.errorCode,
        record.schemaVersion,
      ],
    );
    this.records.set(cacheKey(record), record);
  }
}

function fromRow(row: DatabaseRow): CacheRecord {
  return {
    libraryID: Number(row.library_id),
    itemKey: String(row.item_key),
    normalizedDOI: row.normalized_doi,
    openAlexWorkID: row.openalex_work_id,
    citationCount: row.citation_count === null ? null : Number(row.citation_count),
    status: row.status,
    lastSuccessfulAt: row.last_success_at === null ? null : Number(row.last_success_at),
    lastAttemptedAt: Number(row.last_attempt_at),
    errorCode: row.error_code,
    schemaVersion: Number(row.schema_version),
  };
}
