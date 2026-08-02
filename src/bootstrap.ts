import type { BootstrapData, HttpResponse, PluginPublicAPI } from "./types";
import { CitationStorage } from "./storage";
import { CitationUpdater } from "./updater";
import { CitationColumn } from "./columns";
import { CitationMenus } from "./menus";
import { ConservativeAutoFetcher } from "./auto-fetch";
import { DOIChangeObserver } from "./notifier";
import { getAPIKey, migrateLegacyPreferences } from "./preferences-values";
import { OpenAlexClient } from "./openalex";

interface RuntimeState {
  storage: CitationStorage;
  updater: CitationUpdater;
  column: CitationColumn;
  menus: CitationMenus;
  autoFetcher: ConservativeAutoFetcher;
  observer: DOIChangeObserver;
  preferencePaneID: string | null;
}

let runtime: RuntimeState | null = null;

export async function install(_data: BootstrapData, _reason: number): Promise<void> {
  Zotero.debug("[Zocitally] Installed. Local citation cache is preserved across uninstall/reinstall.");
}

export function onMainWindowLoad({ window }: { window: ZoteroWindowRuntime }): void {
  window.MozXULElement.insertFTLIfNeeded("zocitally.ftl");
}

export async function startup(data: BootstrapData, _reason: number): Promise<void> {
  if (runtime) return;
  const migratedPreferences = migrateLegacyPreferences();
  if (migratedPreferences > 0) {
    Zotero.debug(`[Zocitally] Migrated ${migratedPreferences} setting${migratedPreferences === 1 ? "" : "s"} from a previous preference branch.`);
  }
  const storage = new CitationStorage((name) => new Zotero.DBConnection(name));
  await storage.initialize();
  const updater = new CitationUpdater(storage, () => zoteroTransport);
  const autoFetcher = new ConservativeAutoFetcher(updater);
  const column = new CitationColumn(storage, (item) => autoFetcher.enqueue(item));
  const openSettings = () => {
    if (runtime?.preferencePaneID) Zotero.Utilities.Internal.openPreferences(runtime.preferencePaneID);
    else Zotero.Utilities.Internal.openPreferences();
  };
  const menus = new CitationMenus(updater, openSettings);
  const observer = new DOIChangeObserver(storage);

  for (const window of Zotero.getMainWindows()) {
    window.MozXULElement.insertFTLIfNeeded("zocitally.ftl");
  }

  column.register();
  menus.register();
  observer.register();
  const preferencePaneID = await Zotero.PreferencePanes.register({
    pluginID: data.id,
    id: "zocitally",
    src: "prefs.xhtml",
    scripts: ["preferences.js"],
    stylesheets: ["prefs.css"],
    label: "Zocitally",
  });

  runtime = { storage, updater, column, menus, autoFetcher, observer, preferencePaneID };
  Zotero.Zocitally = createPublicAPI(runtime, openSettings);
  Zotero.debug("[Zocitally] Started");
}

export async function shutdown(_data: BootstrapData, reason: number): Promise<void> {
  if (reason === APP_SHUTDOWN || !runtime) return;
  const state = runtime;
  runtime = null;
  state.autoFetcher.stop();
  state.updater.shutdown();
  state.observer.unregister();
  state.menus.unregister();
  state.column.unregister();
  if (state.preferencePaneID && Zotero.PreferencePanes.unregister) {
    Zotero.PreferencePanes.unregister(state.preferencePaneID);
  }
  await state.storage.close();
  delete Zotero.Zocitally;
  Zotero.debug("[Zocitally] Shut down");
}

export async function uninstall(_data: BootstrapData, _reason: number): Promise<void> {
  // The legacy-named database is intentionally preserved for seamless cache compatibility.
  Zotero.debug("[Zocitally] Uninstalled; local citation cache was preserved.");
}

function createPublicAPI(state: RuntimeState, openSettings: () => void): PluginPublicAPI {
  return {
    async testAPIConnection(): Promise<string> {
      const apiKey = getAPIKey();
      const options: ConstructorParameters<typeof OpenAlexClient>[0] = { transport: zoteroTransport };
      if (apiKey) options.apiKey = apiKey;
      const client = new OpenAlexClient(options);
      await client.testConnection();
      return "Connection successful. OpenAlex accepted the configured API key.";
    },
    async clearCacheFromPreferences(): Promise<string> {
      const count = await state.storage.count();
      const confirmed = Services.prompt.confirm(
        Zotero.getMainWindow(),
        "Clear Citation Cache",
        `Remove ${count} locally cached record${count === 1 ? "" : "s"}? Zotero items will not be modified.`,
      );
      if (!confirmed) return "Cache clearing cancelled.";
      const removed = await state.storage.clear();
      Zotero.ItemTreeManager.refreshColumns();
      return `Removed ${removed} local cache record${removed === 1 ? "" : "s"}. Zotero items were not modified.`;
    },
    openSettings,
  };
}

async function zoteroTransport(url: string): Promise<HttpResponse> {
  const request = await Zotero.HTTP.request("GET", url, {
    timeout: 30_000,
    successCodes: false,
    responseType: "text",
    headers: {
      "User-Agent": "Zocitally/0.2.0 (Zotero plugin; OpenAlex citation client)",
      Accept: "application/json",
    },
  });
  return {
    status: request.status,
    body: request.responseText,
    headers: parseHeaders(request.getAllResponseHeaders()),
  };
}

function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of raw.trim().split(/[\r\n]+/u)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return headers;
}
