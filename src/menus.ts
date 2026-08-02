import { deduplicateItems } from "./items";
import { PLUGIN_ID, type EligibleItem } from "./types";
import { CitationUpdater } from "./updater";

export class CitationMenus {
  private menuIDs: string[] = [];

  constructor(
    private readonly updater: CitationUpdater,
    private readonly openSettings: () => void,
  ) {}

  register(): void {
    if (this.menuIDs.length) return;
    this.registerOne({
      menuID: "zocitally-item-context",
      pluginID: PLUGIN_ID,
      target: "main/library/item",
      menus: [{
        menuType: "menuitem",
        l10nID: "zocitally-context-update",
        onShowing: (_event, context) => {
          context.setVisible(Boolean(context.items?.some((item) => item.isRegularItem() || item.isAttachment())));
        },
        onCommand: (_event, context) => void this.updateContextItems(context.items ?? []),
      }],
    });
    this.registerOne({
      menuID: "zocitally-tools-menu",
      pluginID: PLUGIN_ID,
      target: "main/menubar/tools",
      menus: [
        {
          menuType: "menuitem",
          l10nID: "zocitally-tools-selected",
          enableForTabTypes: ["library"],
          onShowing: (_event, context) => {
            context.setEnabled(Zotero.getActiveZoteroPane().getSelectedItems().length > 0);
          },
          onCommand: () => void this.updateSelected(),
        },
        {
          menuType: "menuitem",
          l10nID: "zocitally-tools-settings",
          onCommand: () => this.openSettings(),
        },
      ],
    });
  }

  unregister(): void {
    for (const id of this.menuIDs) Zotero.MenuManager.unregisterMenu(id);
    this.menuIDs = [];
  }

  private registerOne(options: Parameters<ZoteroGlobalRuntime["MenuManager"]["registerMenu"]>[0]): void {
    const id = Zotero.MenuManager.registerMenu(options);
    if (!id) throw new Error(`Zotero rejected menu registration ${options.menuID}`);
    this.menuIDs.push(id);
  }

  private async updateContextItems(items: ZoteroItemRuntime[]): Promise<void> {
    const resolved = await resolveAttachments(items);
    await this.updater.update(deduplicateItems(resolved));
  }

  private async updateSelected(): Promise<void> {
    const selected = Zotero.getActiveZoteroPane().getSelectedItems();
    await this.updateContextItems(selected);
  }
}

async function resolveAttachments(items: ZoteroItemRuntime[]): Promise<EligibleItem[]> {
  const resolved: EligibleItem[] = [];
  for (const item of items) {
    if (item.isRegularItem()) {
      resolved.push(item);
    } else if (item.isAttachment() && item.parentItemID) {
      const parent = await Zotero.Items.getAsync(item.parentItemID);
      if (parent && parent.isRegularItem()) resolved.push(parent);
    }
  }
  return resolved;
}
