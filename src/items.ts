import type { EligibleItem } from "./types";

export function isEligibleItem(item: EligibleItem): boolean {
  return item.isRegularItem() && !item.isAttachment() && !item.isNote() && !item.isAnnotation();
}

export function deduplicateItems(items: EligibleItem[]): EligibleItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!isEligibleItem(item)) return false;
    const identity = `${item.libraryID}:${item.key}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
