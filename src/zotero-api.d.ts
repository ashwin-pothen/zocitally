import type { EligibleItem, PluginPublicAPI } from "./types";

declare global {
  interface ZoteroItemRuntime extends EligibleItem {
    id: number;
    parentItemID?: number | false;
  }

  interface MenuContextRuntime {
    items?: ZoteroItemRuntime[];
    setVisible(value: boolean): void;
    setEnabled(value: boolean): void;
  }

  interface ZoteroPaneRuntime {
    getSelectedItems(): ZoteroItemRuntime[];
  }

  interface ZoteroWindowRuntime extends Window {
    ZoteroPane?: ZoteroPaneRuntime;
    MozXULElement: {
      insertFTLIfNeeded(path: string): void;
    };
  }

  interface ZoteroGlobalRuntime {
    Zocitally?: PluginPublicAPI;
    debug(message: string, level?: number): void;
    logError(error: unknown): void;
    getMainWindow(): ZoteroWindowRuntime;
    getMainWindows(): ZoteroWindowRuntime[];
    getActiveZoteroPane(): ZoteroPaneRuntime;
    launchURL(url: string): void;
    DBConnection: new (name: string) => import("./storage").DatabaseConnection;
    HTTP: {
      request(method: string, url: string, options: Record<string, unknown>): Promise<{
        status: number;
        responseText: string;
        getAllResponseHeaders(): string;
      }>;
    };
    Prefs: {
      get(name: string): unknown;
      set(name: string, value: string | number | boolean): void;
    };
    Items: {
      getAsync(id: number): Promise<ZoteroItemRuntime | false>;
    };
    ItemTreeManager: {
      registerColumn(options: {
        dataKey: string;
        label: string;
        pluginID: string;
        enabledTreeIDs?: string[];
        width?: string;
        minWidth?: number;
        showInColumnPicker?: boolean;
        zoteroPersist?: string[];
        dataProvider(item: ZoteroItemRuntime, dataKey: string): string;
        renderCell(
          index: number,
          data: string,
          column: { className: string },
          isFirstColumn: boolean,
          document: Document,
        ): HTMLElement;
      }): string | false;
      unregisterColumn(dataKey: string): boolean;
      refreshColumns(): void;
    };
    MenuManager: {
      registerMenu(options: {
        menuID: string;
        pluginID: string;
        target: string;
        menus: Array<{
          menuType: "menuitem" | "separator" | "submenu";
          l10nID?: string;
          enableForTabTypes?: string[];
          onShowing?(event: Event, context: MenuContextRuntime): void;
          onCommand?(event: Event, context: MenuContextRuntime): void;
        }>;
      }): string | false;
      unregisterMenu(menuID: string): boolean;
    };
    PreferencePanes: {
      register(options: {
        pluginID: string;
        src: string;
        id?: string;
        scripts?: string[];
        stylesheets?: string[];
        label?: string;
        image?: string;
      }): Promise<string>;
      unregister?(paneID: string): void;
    };
    ProgressWindow: new (options?: { window?: Window; closeOnClick?: boolean }) => {
      show(): boolean;
      changeHeadline(text: string): void;
      addDescription(text: string): void;
      close(): void;
      startCloseTimer(milliseconds?: number): void;
      ItemProgress: new (itemType: string | null, text: string) => {
        setText(text: string): void;
        setProgress(percent: number): void;
        setError(): void;
      };
    };
    Notifier: {
      registerObserver(
        observer: { notify(event: string, type: string, ids: number[]): Promise<void> | void },
        types: string[],
        id: string,
      ): string;
      unregisterObserver(id: string): void;
    };
    Utilities: {
      Internal: {
        openPreferences(paneID?: string): void;
      };
    };
  }

  const Zotero: ZoteroGlobalRuntime;
  const Services: {
    prefs: {
      prefHasUserValue(name: string): boolean;
    };
    prompt: {
      alert(window: Window | null, title: string, message: string): void;
      confirm(window: Window | null, title: string, message: string): boolean;
    };
  };
  const APP_SHUTDOWN: number;
}

export {};
