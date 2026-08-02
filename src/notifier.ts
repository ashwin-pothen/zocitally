import { normalizeDOI } from "./utils/doi";
import { CitationStorage } from "./storage";
import { PLUGIN_ID } from "./types";

export class DOIChangeObserver {
  private observerID: string | null = null;

  constructor(private readonly storage: CitationStorage) {}

  register(): void {
    if (this.observerID) return;
    this.observerID = Zotero.Notifier.registerObserver(
      {
        notify: async (event, type, ids) => {
          if (type !== "item" || event !== "modify") return;
          for (const id of ids) {
            const item = await Zotero.Items.getAsync(id);
            if (!item || !item.isRegularItem()) continue;
            const identity = { libraryID: item.libraryID, itemKey: item.key };
            const cached = this.storage.getSync(identity);
            if (!cached) continue;
            const currentDOI = normalizeDOI(item.getField("DOI"));
            if (cached.normalizedDOI !== currentDOI) {
              if (currentDOI === null) {
                await this.storage.saveTerminalStatus(identity, null, "missing-doi");
              } else {
                await this.storage.saveError(identity, currentDOI, "doi-changed");
              }
              Zotero.ItemTreeManager.refreshColumns();
            }
          }
        },
      },
      ["item"],
      PLUGIN_ID,
    );
  }

  unregister(): void {
    if (!this.observerID) return;
    Zotero.Notifier.unregisterObserver(this.observerID);
    this.observerID = null;
  }
}
