import { describe, expect, it } from "vitest";
import { migratePreferenceValues, type PreferenceMigrationStore } from "../src/preferences-values";

function preferenceStore(initial: Record<string, string | number | boolean>): {
  store: PreferenceMigrationStore;
  values: Map<string, string | number | boolean>;
  userValues: Set<string>;
} {
  const values = new Map(Object.entries(initial));
  const userValues = new Set(Object.keys(initial));
  return {
    values,
    userValues,
    store: {
      hasUserValue: (name) => userValues.has(name),
      get: (name) => values.get(name),
      set: (name, value) => {
        values.set(name, value);
        userValues.add(name);
      },
    },
  };
}

describe("Zocitally preference migration", () => {
  it("copies CiteSight user settings once", () => {
    const { store, values } = preferenceStore({
      "extensions.citesight.apiKey": "legacy-key",
      "extensions.citesight.autoFetch": true,
      "extensions.citesight.refreshIntervalDays": 90,
      "extensions.citesight.maxConcurrency": 5,
    });

    expect(migratePreferenceValues(store)).toBe(4);
    expect(values.get("extensions.zocitally.apiKey")).toBe("legacy-key");
    expect(values.get("extensions.zocitally.autoFetch")).toBe(true);
    expect(values.get("extensions.zocitally.refreshIntervalDays")).toBe(90);
    expect(values.get("extensions.zocitally.maxConcurrency")).toBe(5);
    expect(values.get("extensions.zocitally.migrationVersion")).toBe(1);
    expect(migratePreferenceValues(store)).toBe(0);
  });

  it("falls back to the earlier legacy preference branch", () => {
    const { store, values } = preferenceStore({
      "extensions.openalex-citations.apiKey": "earlier-key",
    });

    expect(migratePreferenceValues(store)).toBe(1);
    expect(values.get("extensions.zocitally.apiKey")).toBe("earlier-key");
  });

  it("does not overwrite an existing Zocitally user setting", () => {
    const { store, values } = preferenceStore({
      "extensions.openalex-citations.apiKey": "legacy-key",
      "extensions.citesight.apiKey": "citesight-key",
      "extensions.zocitally.apiKey": "current-key",
    });

    expect(migratePreferenceValues(store)).toBe(0);
    expect(values.get("extensions.zocitally.apiKey")).toBe("current-key");
  });
});
