import { decodeSortValue, isCacheStale, numericSortValue } from "./cache-logic";
import { isEligibleItem } from "./items";
import { getAutoFetch, getRefreshIntervalDays } from "./preferences-values";
import { CitationStorage } from "./storage";
import { PLUGIN_ID, type EligibleItem } from "./types";

const DATA_KEY = "zocitallyCitationCount";

export class CitationColumn {
  private registeredDataKey: string | null = null;

  constructor(
    private readonly storage: CitationStorage,
    private readonly onUncachedVisible: (item: EligibleItem) => void,
  ) {}

  register(): void {
    if (this.registeredDataKey) return;
    const registered = Zotero.ItemTreeManager.registerColumn({
      dataKey: DATA_KEY,
      label: "Citations",
      pluginID: PLUGIN_ID,
      enabledTreeIDs: ["main"],
      width: "120",
      minWidth: 80,
      showInColumnPicker: true,
      zoteroPersist: ["width", "hidden", "sortDirection"],
      dataProvider: (item) => {
        if (!isEligibleItem(item)) return "";
        const record = this.storage.getSync({ libraryID: item.libraryID, itemKey: item.key });
        if (!record && getAutoFetch()) this.onUncachedVisible(item);
        return numericSortValue(record);
      },
      renderCell: (_index, data, column, _isFirstColumn, document) => {
        const cell = document.createElement("span");
        cell.className = `cell ${column.className}`;
        cell.style.display = "block";
        cell.style.width = "100%";
        cell.style.textAlign = "right";
        cell.style.fontVariantNumeric = "tabular-nums";
        const record = decodeSortValue(data);
        if (!record) {
          cell.textContent = "";
          cell.title = "Citation count not fetched";
          return cell;
        }
        if (record.citationCount !== null) {
          cell.textContent = String(record.citationCount);
        } else if (record.status === "missing-doi") {
          cell.textContent = "—";
        } else if (record.status === "not-found") {
          cell.textContent = "∅";
        } else {
          cell.textContent = "!";
        }
        cell.title = tooltip(record);
        return cell;
      },
    });
    if (!registered) throw new Error("Zotero rejected Zocitally citation column registration");
    this.registeredDataKey = registered;
  }

  unregister(): void {
    if (!this.registeredDataKey) return;
    Zotero.ItemTreeManager.unregisterColumn(this.registeredDataKey);
    this.registeredDataKey = null;
  }
}

function tooltip(record: import("./types").CacheRecord): string {
  const stale = isCacheStale(record, getRefreshIntervalDays()) ? "\nCached value is stale" : "";
  if (record.citationCount !== null) {
    const updated = record.lastSuccessfulAt === null ? "Unknown" : new Date(record.lastSuccessfulAt).toLocaleString();
    return [
      `OpenAlex citations: ${record.citationCount}`,
      `Last successful update: ${updated}`,
      `DOI: ${record.normalizedDOI ?? "Unknown"}`,
      ...(record.openAlexWorkID ? [`OpenAlex work: ${record.openAlexWorkID}`] : []),
      ...(record.status === "error" ? [`Last refresh error: ${record.errorCode ?? "unknown error"}`] : []),
    ].join("\n") + stale;
  }
  if (record.status === "missing-doi") return "No DOI available";
  if (record.status === "not-found") return `DOI not found in OpenAlex\nDOI: ${record.normalizedDOI ?? "Unknown"}`;
  return `Citation count not fetched\n${record.errorCode ?? "Unknown error"}`;
}
