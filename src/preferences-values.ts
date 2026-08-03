import { LEGACY_PREF_BRANCHES, PREF_BRANCH } from "./types";

const PREFERENCE_MIGRATION_VERSION = 1;
const MIGRATION_VERSION_KEY = `${PREF_BRANCH}migrationVersion`;
const MIGRATED_SETTING_NAMES = ["apiKey", "autoFetch", "maxConcurrency"] as const;

export interface PreferenceMigrationStore {
  hasUserValue(name: string): boolean;
  get(name: string): unknown;
  set(name: string, value: string | number | boolean): void;
}

export function migrateLegacyPreferences(): number {
  return migratePreferenceValues({
    hasUserValue: (name) => Services.prefs.prefHasUserValue(name),
    get: (name) => Zotero.Prefs.get(name),
    set: (name, value) => Zotero.Prefs.set(name, value),
  });
}

export function migratePreferenceValues(store: PreferenceMigrationStore): number {
  if (Number(store.get(MIGRATION_VERSION_KEY)) >= PREFERENCE_MIGRATION_VERSION) return 0;

  let migrated = 0;
  for (const name of MIGRATED_SETTING_NAMES) {
    const newKey = `${PREF_BRANCH}${name}`;
    if (store.hasUserValue(newKey)) continue;
    const oldKey = LEGACY_PREF_BRANCHES
      .map((branch) => `${branch}${name}`)
      .find((key) => store.hasUserValue(key));
    if (!oldKey) continue;
    const value = store.get(oldKey);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      store.set(newKey, value);
      migrated += 1;
    }
  }
  store.set(MIGRATION_VERSION_KEY, PREFERENCE_MIGRATION_VERSION);
  return migrated;
}

export function getAPIKey(): string {
  const value = Zotero.Prefs.get(`${PREF_BRANCH}apiKey`);
  return typeof value === "string" ? value.trim() : "";
}

export function getAutoFetch(): boolean {
  return Zotero.Prefs.get(`${PREF_BRANCH}autoFetch`) === true;
}

export function getMaxConcurrency(): number {
  const value = Number(Zotero.Prefs.get(`${PREF_BRANCH}maxConcurrency`));
  return Number.isInteger(value) ? Math.max(1, Math.min(5, value)) : 3;
}
